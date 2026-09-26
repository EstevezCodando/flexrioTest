<#
.SYNOPSIS
  Sobe o Rio Flex nesta máquina, integrado à FlexIA (e ao acervo do Cavuca) que rodam na AWS.

.DESCRIPTION
  - Rio Flex (API + frontend + SQLite) roda LOCALMENTE, numa única porta (padrão 8080), em modo produção.
  - FlexIA roda na AWS (Bedrock AgentCore Runtime: data lake, documentos coletados pelo Cavuca, Nemotron + Claude).
  - As credenciais AWS e o ARN do runtime são lidos do .env da FlexIA e ficam só neste processo:
    nada é gravado no repositório do Rio Flex.

  Credenciais do workshop expiram em poucas horas. Para renovar:
    cd C:\Desenvolvimento\Hackathon\FlexIA ; .\configurar.ps1 -SalvarCredenciais

.EXAMPLE
  .\scripts\local-aws.ps1                 # verifica a FlexIA na AWS, compila o front (se preciso) e sobe em :8080
  .\scripts\local-aws.ps1 -Build          # força recompilar o frontend
  .\scripts\local-aws.ps1 -Dev            # modo desenvolvimento (API :5000 + Vite com hot reload)
  .\scripts\local-aws.ps1 -SoVerificar    # só testa a conexão com a FlexIA na AWS
  .\scripts\local-aws.ps1 -SemAws         # sobe sem AWS (FlexIA local), para ensaio offline
#>
param(
  [int]$Porta = 8080,
  [string]$EnvFlexia = "",
  [switch]$Build,
  [switch]$Dev,
  [switch]$SoVerificar,
  [switch]$SemAws,
  [switch]$IgnorarFalhaAws
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8   # acentos da saída do Node no console do Windows
$Raiz = Split-Path -Parent $PSScriptRoot
$Api = Join-Path $Raiz "artifacts\api-server"
$Web = Join-Path $Raiz "artifacts\rio-flex"
if (-not $EnvFlexia) { $EnvFlexia = Join-Path (Split-Path -Parent (Split-Path -Parent $Raiz)) "FlexIA\.env" }


Write-Host "== Rio Flex local + FlexIA na AWS" -ForegroundColor Cyan

if (-not $SemAws) {
  if (-not (Test-Path $EnvFlexia)) { throw "Não achei o .env da FlexIA em $EnvFlexia (use -EnvFlexia <caminho>)." }
  # Do .env da FlexIA vêm só o ARN do runtime e, se houver, o perfil. As chaves temporárias NÃO entram no
  # ambiente: a API as relê do próprio arquivo a cada minuto (AWS_CREDENTIALS_ENV_FILE), então renovar com
  # .\configurar.ps1 -SalvarCredenciais vale na hora, sem reiniciar o Rio Flex.
  $permitidas = "AWS_PROFILE", "FLEXIA_RUNTIME_ARN"
  if (Select-String -Path $EnvFlexia -Pattern '^\s*AWS_ACCESS_KEY_ID\s*=\s*\S' -Quiet) { $env:AWS_CREDENTIALS_ENV_FILE = (Resolve-Path $EnvFlexia).Path }
  foreach ($linha in Get-Content $EnvFlexia -Encoding UTF8) {
    if ($linha -match '^\s*([A-Z_]+)\s*=\s*(.+?)\s*$' -and $permitidas -contains $Matches[1]) {
      $valor = $Matches[2].Trim('"').Trim("'")
      if ($valor -and -not (Get-Item "Env:$($Matches[1])" -ErrorAction SilentlyContinue)) { Set-Item "Env:$($Matches[1])" $valor }
    }
  }
  if (-not $env:FLEXIA_RUNTIME_ARN) { throw "FLEXIA_RUNTIME_ARN vazio no .env da FlexIA." }
  $env:AWS_REGION = $env:FLEXIA_RUNTIME_ARN.Split(":")[3]
  $env:FLEXIA_BACKEND = "agentcore"
  Write-Host ("   runtime: {0}  região: {1}  credenciais: {2}" -f $env:FLEXIA_RUNTIME_ARN.Split("/")[-1], $env:AWS_REGION,
    $(if ($env:AWS_CREDENTIALS_ENV_FILE) { "chaves do .env da FlexIA (relidas a cada minuto)" } else { "perfil $($env:AWS_PROFILE)" }))

  Write-Host "== 1. testando a FlexIA na AWS" -ForegroundColor Cyan
  Push-Location $Api
  try { node --import tsx src/flexia/check.ts; $codigo = $LASTEXITCODE } finally { Pop-Location }
  if ($SoVerificar) { exit $codigo }
  if ($codigo -ne 0) {
    if (-not $IgnorarFalhaAws) {
      Write-Host "`nA FlexIA na AWS não respondeu (código $codigo). Corrija acima ou rode com -IgnorarFalhaAws (o chat cai no motor local)." -ForegroundColor Yellow
      exit $codigo
    }
    Write-Host "   seguindo mesmo assim: respostas do setor cairão no motor local com aviso" -ForegroundColor Yellow
  }
} else {
  $env:FLEXIA_BACKEND = "local"
}

$env:DEMO_ACCOUNTS = "true"        # contas de demonstração (senhas no README) — ambiente local
$env:COOKIE_SECURE = "false"       # http://localhost
$env:TRUST_PROXY = "0"
$env:FLEXIA_TIMEOUT_MS = "90000"

if ($Dev) {
  Write-Host "== 2. modo desenvolvimento: API :5000 + Vite (hot reload)" -ForegroundColor Cyan
  Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
  Start-Process -NoNewWindow -FilePath "powershell" -ArgumentList "-NoProfile", "-Command", "Set-Location '$Web'; npx vite --config vite.config.ts"
  Push-Location $Api; try { node --import tsx --watch src/index.ts } finally { Pop-Location }
  exit $LASTEXITCODE
}

if ($Build -or -not (Test-Path (Join-Path $Web "dist\index.html"))) {
  Write-Host "== 2. compilando o frontend" -ForegroundColor Cyan
  Push-Location $Web; try { npx vite build --config vite.config.ts } finally { Pop-Location }
} else {
  Write-Host "== 2. frontend já compilado (use -Build para recompilar)" -ForegroundColor Cyan
}

Write-Host "== 3. subindo em http://localhost:$Porta" -ForegroundColor Cyan
$env:NODE_ENV = "production"
$env:PORT = "$Porta"
$env:WEB_DIST = Join-Path $Web "dist"
$env:DB_PATH = Join-Path $Api "data\rioflex.db"
Write-Host "   motorista: /login   gestor: /gestor/login   FlexIA: /gestor/flexia   prontidão: /api/ready"
Push-Location $Api
try { node --import tsx src/index.ts } finally { Pop-Location }
