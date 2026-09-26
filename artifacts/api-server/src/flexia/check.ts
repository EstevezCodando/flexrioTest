/**
 * Teste de ponta a ponta da FlexIA na AWS a partir desta máquina: invoca o runtime do Bedrock AgentCore
 * com as credenciais do ambiente e mede latência do primeiro token e total.
 *
 * Uso: pnpm --filter @workspace/api-server flexia:check ["pergunta"]
 * Saída 0 = conectado; 2 = credenciais; 3 = permissão; 4 = runtime/ARN; 1 = outro erro.
 */
import { config } from '../config.ts';
import { credentialSource, invokeFlexiaAgentCore } from './agentcore.ts';

const pergunta = process.argv[2] ?? 'Responda em uma frase: quem é você e quais fontes de dados você consulta?';
const arn = config.flexia.runtimeArn;

if (!arn) {
  console.error('FLEXIA_RUNTIME_ARN não definido. Rode pelo scripts/local-aws.ps1 (lê o .env da FlexIA).');
  process.exit(4);
}

console.log(`runtime:     ${arn.split('/').pop()} (${arn.split(':')[3]})`);
console.log(`credenciais: ${credentialSource()}`);
console.log(`pergunta:    ${pergunta}\n`);

const t0 = Date.now();
let primeiro: number | null = null;
let texto = '';
const ferramentas: string[] = [];
const abort = new AbortController();
const timer = setTimeout(() => abort.abort(), config.flexia.timeoutMs);

try {
  for await (const ev of invokeFlexiaAgentCore(pergunta, `rioflex-check-${Date.now()}-000000000000000000`, abort.signal)) {
    if (ev.type === 'delta') {
      primeiro ??= Date.now() - t0;
      texto += ev.text;
      process.stdout.write(ev.text);
    } else {
      ferramentas.push(ev.name);
      process.stdout.write(`\n  [ferramenta AWS: ${ev.name}]\n`);
    }
  }
  clearTimeout(timer);
  console.log(`\n\nOK  primeiro token: ${primeiro ?? '-'} ms · total: ${Date.now() - t0} ms · ${texto.length} caracteres · ferramentas: ${ferramentas.join(', ') || 'nenhuma'}`);
  process.exit(texto.trim() ? 0 : 1);
} catch (err) {
  clearTimeout(timer);
  const name = (err as { name?: string }).name ?? '';
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`\nFALHA ${name}: ${msg.slice(0, 300)}`);
  if (/ExpiredToken|UnrecognizedClient|InvalidClientTokenId|CredentialsProviderError|security token/i.test(name + msg)) {
    console.error('→ Credenciais ausentes ou expiradas. Renove no painel do evento e rode, na pasta da FlexIA:  .\\configurar.ps1 -SalvarCredenciais');
    process.exit(2);
  }
  if (/AccessDenied/i.test(name + msg)) {
    console.error('→ O usuário não tem bedrock-agentcore:InvokeAgentRuntime neste runtime.');
    process.exit(3);
  }
  if (/ResourceNotFound|ValidationException/i.test(name + msg)) {
    console.error('→ Runtime não encontrado: confira FLEXIA_RUNTIME_ARN no .env da FlexIA.');
    process.exit(4);
  }
  if (abort.signal.aborted) console.error(`→ Sem resposta em ${config.flexia.timeoutMs} ms.`);
  process.exit(1);
}
