"""Implanta o Rio Flex na AWS da equipe, integrado à FlexIA que já roda no Bedrock AgentCore.

Mesmo caminho que funcionou para a FlexIA na conta do workshop (sem iam:PassRole, sem CloudFront/API
Gateway): o pacote vai para o bucket do projeto e a instância do Code Editor o executa via Systems
Manager, usando a role da própria instância — que já tem permissão de invocar o runtime da FlexIA.

Etapas (cada uma pode ser rodada sozinha):
  verificar   credenciais, bucket, instância no SSM, runtime da FlexIA, Docker/Node na instância. Não altera nada.
  publicar    git archive do commit atual -> s3://<bucket>/rioflex/releases/<commit>.tar.gz
  implantar   na instância: baixa, constrói (Docker; ou Node 24 se não houver Docker) e sobe na porta 8080
  status      estado do serviço, /api/ready e últimos logs
  acesso      mostra como abrir o sistema (IP público, grupo de segurança, túnel SSM)
  liberar-ip  --cidr X.X.X.X/32  abre a porta 8080 só para esse IP (ALTERA o grupo de segurança)

Credenciais e alvos vêm de um .env (padrão: o da FlexIA, ../../FlexIA/.env, que o configurar.ps1 mantém):
  AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/AWS_SESSION_TOKEN ou AWS_PROFILE, CODE_EDITOR_INSTANCIA,
  FLEXIA_BUCKET, FLEXIA_RUNTIME_ARN. Opcional: RIOFLEX_ENV_FILE (variáveis do contêiner).

Uso:  python deploy/aws/implantar.py verificar
      python deploy/aws/implantar.py publicar implantar status acesso
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
AQUI = Path(__file__).resolve().parent
USUARIO = "participant"
# 8080 já é usado pelo próprio Code Editor (VS Code Server) do workshop no host
# (127.0.0.1:8080) — com --network host isso colidia e derrubava o contêiner
# silenciosamente logo após o "api.started" (EADDRINUSE na porta compartilhada).
PORTA = 8090
# Sobrescrevível: nesta conta/sandbox a instância do Code Editor está em us-west-2, não us-east-1.
REGIAO_SSM = os.environ.get("RIOFLEX_REGIAO_SSM", "us-east-1")


# ------------------------------------------------------------------ configuração
def carregar_env(caminho: Path) -> None:
    if not caminho.exists():
        return
    for linha in caminho.read_text(encoding="utf-8-sig").splitlines():
        linha = linha.strip()
        if not linha or linha.startswith("#") or "=" not in linha:
            continue
        k, v = linha.split("=", 1)
        k, v = k.strip().removeprefix("export ").strip(), v.strip().strip('"').strip("'")
        if k and v and k not in os.environ:
            os.environ[k] = v


def env_padrao() -> Path:
    if os.environ.get("RIOFLEX_DEPLOY_ENV"):
        return Path(os.environ["RIOFLEX_DEPLOY_ENV"])
    local = AQUI / "deploy.env"
    return local if local.exists() else RAIZ.parents[1] / "FlexIA" / ".env"


def sessao(regiao: str = REGIAO_SSM):
    import boto3
    if os.environ.get("AWS_ACCESS_KEY_ID"):
        return boto3.Session(region_name=regiao)
    return boto3.Session(profile_name=os.environ.get("AWS_PROFILE") or "hackathon", region_name=regiao)


def ok(rotulo: str, detalhe: str = "") -> None:
    print(f"  OK    {rotulo}{'  ' + detalhe if detalhe else ''}")


def falha(rotulo: str, detalhe: str = "") -> None:
    print(f"  FALHA {rotulo}{'  ' + detalhe if detalhe else ''}")


# ------------------------------------------------------------------ SSM
def instancia(ssm) -> str:
    if os.environ.get("CODE_EDITOR_INSTANCIA"):
        return os.environ["CODE_EDITOR_INSTANCIA"]
    ids = [i["InstanceId"] for i in ssm.describe_instance_information()["InstanceInformationList"]
           if i.get("PlatformType") == "Linux" and i.get("PingStatus") == "Online"]
    if len(ids) != 1:
        raise SystemExit(f"defina CODE_EDITOR_INSTANCIA (instâncias online: {ids})")
    os.environ["CODE_EDITOR_INSTANCIA"] = ids[0]
    return ids[0]


def remoto(script: str, timeout_s: int = 1800, como_root: bool = False) -> tuple[int, str, str]:
    """Executa bash na instância do Code Editor e devolve (código, stdout, stderr)."""
    ssm = sessao().client("ssm")
    iid = instancia(ssm)
    corpo = f"set -o pipefail\nexport PATH=\"$HOME/.local/bin:$PATH\"\n{script}"
    comando = corpo if como_root else f"sudo -u {USUARIO} -i bash <<'__RIOFLEX__'\n{corpo}\n__RIOFLEX__"
    cid = ssm.send_command(InstanceIds=[iid], DocumentName="AWS-RunShellScript",
                           Parameters={"commands": [comando], "executionTimeout": [str(timeout_s)]},
                           TimeoutSeconds=600, Comment="Rio Flex")["Command"]["CommandId"]
    while True:
        time.sleep(3)
        try:
            r = ssm.get_command_invocation(CommandId=cid, InstanceId=iid)
        except ssm.exceptions.InvocationDoesNotExist:
            continue
        if r["Status"] not in ("Pending", "InProgress", "Delayed"):
            return r["ResponseCode"], r["StandardOutputContent"], r["StandardErrorContent"]


# ------------------------------------------------------------------ etapas
def commit_atual() -> str:
    return subprocess.check_output(["git", "rev-parse", "--short=12", "HEAD"], cwd=RAIZ, text=True).strip()


def bucket(s) -> str:
    if os.environ.get("RIOFLEX_BUCKET") or os.environ.get("FLEXIA_BUCKET"):
        return os.environ.get("RIOFLEX_BUCKET") or os.environ["FLEXIA_BUCKET"]
    conta = s.client("sts").get_caller_identity()["Account"]
    return f"ons-datalake-{conta}"


def verificar(_args) -> int:
    s = sessao()
    try:
        ident = s.client("sts").get_caller_identity()
        ok("credenciais AWS", ident["Arn"].split(":")[-1])
    except Exception as e:  # noqa: BLE001
        falha("credenciais AWS", str(e)[:140])
        print("\n  Atualize as chaves (painel do evento > Get AWS CLI credentials) no .env da FlexIA:"
              "\n    cd C:\\Desenvolvimento\\Hackathon\\FlexIA ; .\\configurar.ps1 -SalvarCredenciais")
        return 1
    b = bucket(s)
    try:
        s.client("s3").head_bucket(Bucket=b)
        ok("bucket", f"s3://{b}")
    except Exception as e:  # noqa: BLE001
        falha("bucket", f"{b}: {str(e)[:100]}")
    try:
        iid = instancia(s.client("ssm"))
        ok("instância do Code Editor (SSM)", iid)
    except SystemExit as e:
        falha("instância do Code Editor", str(e))
        return 1
    arn = os.environ.get("FLEXIA_RUNTIME_ARN", "")
    if arn:
        try:
            ctl = sessao(arn.split(":")[3]).client("bedrock-agentcore-control")
            rt = ctl.get_agent_runtime(agentRuntimeId=arn.split("/")[-1])
            ok("FlexIA no AgentCore", f"{rt.get('agentRuntimeName')} status={rt.get('status')}")
        except Exception as e:  # noqa: BLE001
            print(f"  AVISO FlexIA no AgentCore  não consegui consultar pelo seu usuário ({str(e)[:90]}); a instância testa abaixo")
    else:
        falha("FLEXIA_RUNTIME_ARN", "vazio — o Rio Flex usará o motor local")
    teste_arn_script = (
        "python3 - <<'PY'\n"
        "import boto3,json\n"
        f"arn='{arn}'\n"
        "c=boto3.client('bedrock-agentcore',region_name=arn.split(':')[3])\n"
        "try:\n"
        "    r=c.invoke_agent_runtime(agentRuntimeArn=arn,runtimeSessionId='rioflex-verificacao-0000000000000000000',payload=json.dumps({'prompt':'Responda apenas: ok'}).encode())\n"
        "    n=sum(1 for l in r['response'].iter_lines() if l)\n"
        "    print('flexia_da_instancia: ok', n, 'eventos')\n"
        "except Exception as e:\n"
        "    print('flexia_da_instancia: FALHA', str(e)[:160])\n"
        "PY"
    ) if arn else "echo 'flexia_da_instancia: sem ARN'"
    codigo, saida, erro = remoto(f"""
echo "docker: $(docker --version 2>/dev/null || echo ausente)"
echo "docker_ok: $(docker info >/dev/null 2>&1 && echo sim || (sudo -n docker info >/dev/null 2>&1 && echo sudo || echo nao))"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1
echo "node: $(node --version 2>/dev/null || echo ausente)"
echo "disco_livre: $(df -h $HOME | awk 'NR==2{{print $4}}')"
echo "identidade: $(aws sts get-caller-identity --query Arn --output text 2>/dev/null | awk -F: '{{print $NF}}')"
{teste_arn_script}
""", timeout_s=300)
    print("\n  -- instância --")
    print("  " + saida.strip().replace("\n", "\n  "))
    if erro.strip():
        print("  stderr: " + erro.strip()[-500:])
    return 0 if codigo == 0 else 1


def publicar(args) -> int:
    s = sessao()
    sha = commit_atual()
    sujo = subprocess.run(["git", "status", "--porcelain", "--untracked-files=no"], cwd=RAIZ, capture_output=True, text=True).stdout.strip()
    if sujo:
        print("  AVISO há alterações não commitadas; o pacote contém somente o commit", sha)
    destino = f"rioflex/releases/{sha}.tar.gz"
    with tempfile.TemporaryDirectory() as tmp:
        arq = Path(tmp) / f"{sha}.tar.gz"
        subprocess.check_call(["git", "archive", "--format=tar.gz", "-o", str(arq), "HEAD"], cwd=RAIZ)
        b = bucket(s)
        s.client("s3").upload_file(str(arq), b, destino)
        ok("pacote publicado", f"s3://{b}/{destino} ({arq.stat().st_size / 1e6:.1f} MB)")
    args.release = sha
    return 0


def conteudo_env() -> str:
    """Variáveis do contêiner. Sem chaves AWS: dentro da instância vale a role dela."""
    arquivo = Path(os.environ.get("RIOFLEX_ENV_FILE", AQUI / "rioflex.env"))
    base = arquivo.read_text(encoding="utf-8") if arquivo.exists() else (AQUI / "rioflex.env.example").read_text(encoding="utf-8")
    linhas = [l for l in base.splitlines() if l.strip() and not l.strip().startswith("#")]
    chaves = {l.split("=", 1)[0] for l in linhas}
    arn = os.environ.get("FLEXIA_RUNTIME_ARN", "")
    if arn and "FLEXIA_RUNTIME_ARN" not in chaves:
        linhas.append(f"FLEXIA_RUNTIME_ARN={arn}")
    if arn and "AWS_REGION" not in chaves:
        linhas.append(f"AWS_REGION={arn.split(':')[3]}")
    return "\n".join(linhas) + "\n"


def implantar(args) -> int:
    s = sessao()
    sha = getattr(args, "release", None) or commit_atual()
    b = bucket(s)
    env = conteudo_env()
    script = f"""
set -e
BASE="$HOME/rioflex"; REL="$BASE/releases/{sha}"; mkdir -p "$BASE/releases" "$BASE/data"
echo "== 1. pacote {sha}"
aws s3 cp "s3://{b}/rioflex/releases/{sha}.tar.gz" "$BASE/releases/{sha}.tar.gz" --region {REGIAO_SSM} --quiet
rm -rf "$REL" && mkdir -p "$REL" && tar -xzf "$BASE/releases/{sha}.tar.gz" -C "$REL"
cat > "$BASE/rioflex.env" <<'__ENV__'
{env}__ENV__
chmod 600 "$BASE/rioflex.env"
DOCKER=""
if docker info >/dev/null 2>&1; then DOCKER="docker"; elif sudo -n docker info >/dev/null 2>&1; then DOCKER="sudo docker"; fi
MODO="{args.modo}"
[ "$MODO" = "auto" ] && {{ [ -n "$DOCKER" ] && MODO=docker || MODO=node; }}
echo "== 2. modo: $MODO"
if [ "$MODO" = "docker" ]; then
  [ -z "$DOCKER" ] && {{ echo "Docker indisponível na instância"; exit 3; }}
  cd "$REL"
  $DOCKER build -q -t rioflex:{sha} -t rioflex:latest . | tail -1
  $DOCKER rm -f rioflex >/dev/null 2>&1 || true
  # --network host: o contêiner usa a role da instância via IMDS sem ajustes de hop limit.
  $DOCKER run -d --name rioflex --restart unless-stopped --network host \\
    --env-file "$BASE/rioflex.env" -e PORT={PORTA} -v rioflex-data:/data rioflex:{sha} >/dev/null
else
  [ -s "$HOME/.nvm/nvm.sh" ] || {{ curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash >/dev/null; }}
  . "$HOME/.nvm/nvm.sh"
  nvm install 24 >/dev/null && nvm use 24 >/dev/null
  npm install -g pnpm@10.34.5 >/dev/null 2>&1 || true
  cd "$REL"
  CI=true pnpm install --frozen-lockfile >/dev/null
  pnpm --filter @workspace/rio-flex run build >/dev/null
  pkill -f "rioflex-api" >/dev/null 2>&1 || true
  cd "$REL/artifacts/api-server"
  set -a; . "$BASE/rioflex.env"; set +a
  export NODE_ENV=production PORT={PORTA} DB_PATH="$BASE/data/rioflex.db" WEB_DIST="$REL/artifacts/rio-flex/dist"
  nohup node --title=rioflex-api --import tsx src/index.ts >> "$BASE/rioflex.log" 2>&1 &
fi
ln -sfn "$REL" "$BASE/current"
echo "== 3. aguardando /api/ready"
for i in $(seq 1 60); do
  R=$(curl -s -m 3 http://127.0.0.1:{PORTA}/api/ready || true)
  echo "$R" | grep -q '"ready"' && {{ echo "pronto: $R"; exit 0; }}
  sleep 3
done
echo "não ficou pronto em 180 s"; ($DOCKER logs --tail 40 rioflex 2>/dev/null || tail -40 "$BASE/rioflex.log"); exit 4
"""
    codigo, saida, erro = remoto(script, timeout_s=2400)
    print(saida.strip()[-3000:])
    if erro.strip():
        print("--- stderr ---\n" + erro.strip()[-2000:])
    return 0 if codigo == 0 else 1


def status(_args) -> int:
    codigo, saida, erro = remoto(f"""
(docker ps --filter name=rioflex --format '{{{{.Names}}}} {{{{.Status}}}}' 2>/dev/null || sudo -n docker ps --filter name=rioflex --format '{{{{.Names}}}} {{{{.Status}}}}' 2>/dev/null || pgrep -af rioflex-api) || true
curl -s -m 5 http://127.0.0.1:{PORTA}/api/ready; echo
(docker logs --tail 15 rioflex 2>/dev/null || sudo -n docker logs --tail 15 rioflex 2>/dev/null || tail -15 "$HOME/rioflex/rioflex.log") 2>&1 | cut -c1-220
""", timeout_s=120)
    print(saida.strip())
    return 0 if codigo == 0 else 1


def acesso(_args) -> int:
    s = sessao()
    ec2 = s.client("ec2")
    iid = instancia(s.client("ssm"))
    inst = ec2.describe_instances(InstanceIds=[iid])["Reservations"][0]["Instances"][0]
    ip = inst.get("PublicIpAddress")
    sgs = [g["GroupId"] for g in inst.get("SecurityGroups", [])]
    print(f"  instância {iid}  IP público: {ip or 'nenhum'}  grupos: {', '.join(sgs)}")
    regras = ec2.describe_security_groups(GroupIds=sgs)["SecurityGroups"] if sgs else []
    abertas = [(g["GroupId"], r) for g in regras for r in g.get("IpPermissions", [])
               if r.get("FromPort") is not None and r["FromPort"] <= PORTA <= r.get("ToPort", r["FromPort"])]
    if ip and abertas:
        print(f"\n  Acesso direto: http://{ip}:{PORTA}")
    else:
        print(f"\n  A porta {PORTA} não está liberada. Opções:")
        print(f"   1) Liberar só para o IP do apresentador (altera o grupo de segurança):")
        print(f"        python deploy/aws/implantar.py liberar-ip --cidr <seu-ip>/32")
        print(f"   2) Túnel SSM (nada fica exposto; exige AWS CLI + Session Manager plugin na máquina):")
        print(f"        aws ssm start-session --target {iid} --document-name AWS-StartPortForwardingSession "
              f"--parameters portNumber={PORTA},localPortNumber={PORTA} --region {REGIAO_SSM}")
        print(f"        e abra http://localhost:{PORTA}")
    return 0


def liberar_ip(args) -> int:
    if not args.cidr or not args.cidr.endswith("/32"):
        raise SystemExit("informe --cidr <ip>/32 (apenas um endereço)")
    s = sessao()
    ec2 = s.client("ec2")
    iid = instancia(s.client("ssm"))
    sg = ec2.describe_instances(InstanceIds=[iid])["Reservations"][0]["Instances"][0]["SecurityGroups"][0]["GroupId"]
    ec2.authorize_security_group_ingress(GroupId=sg, IpPermissions=[{
        "IpProtocol": "tcp", "FromPort": PORTA, "ToPort": PORTA,
        "IpRanges": [{"CidrIp": args.cidr, "Description": "Rio Flex - demonstracao"}],
    }])
    ok("porta liberada", f"{sg} tcp/{PORTA} <- {args.cidr}")
    return 0


ETAPAS = {"verificar": verificar, "publicar": publicar, "implantar": implantar, "status": status,
          "acesso": acesso, "liberar-ip": liberar_ip}


def main() -> None:
    for fluxo in (sys.stdout, sys.stderr):
        try:
            fluxo.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    p = argparse.ArgumentParser(description="Implantação do Rio Flex na AWS")
    p.add_argument("etapas", nargs="+", choices=list(ETAPAS))
    p.add_argument("--modo", choices=["auto", "docker", "node"], default="auto")
    p.add_argument("--cidr")
    p.add_argument("--env", help="arquivo .env com credenciais e alvos (padrão: .env da FlexIA)")
    args = p.parse_args()
    arquivo = Path(args.env) if args.env else env_padrao()
    carregar_env(arquivo)
    print(f"configuração: {arquivo}")
    for etapa in args.etapas:
        print(f"\n== {etapa}")
        if ETAPAS[etapa](args) != 0:
            sys.exit(1)


if __name__ == "__main__":
    main()
