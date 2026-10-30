# Certificados Vynkor

## Estado

Painel implementado e validado localmente. Infraestrutura de producao configurada em 2026-10-30 na conta Vynkor (`6c728ade65299423aef000f0cf198271`). Nenhum aluno real foi cadastrado.

Banco D1: `vynkor-certificates` (`6a4cf272-b50d-468a-9aa6-4f13cd5b2af9`). Access: `vynkor.cloudflareaccess.com`, aplicacao `0fb7f799-4fcc-4db2-a1e9-40378b9f2383`. Politica reutilizavel `Professores Vynkor` permite somente os dois e-mails abaixo. Previews nao recebem o banco nem as variaveis administrativas de producao.

## Ativacao inicial

1. Criar um D1 chamado `vynkor-certificates` na conta da Vynkor. Executar `migrations/0001_certificates.sql` nesse banco. Nao copiar o banco local `.preview.sqlite`, que contem somente testes.
2. No projeto Pages existente, adicionar binding D1 `CERTIFICATES` apontando para esse banco em producao. Usar banco independente para previews.
3. No Cloudflare Zero Trust, criar uma aplicacao Access self-hosted com os caminhos `vynkor.co/admin`, `vynkor.co/admin/*` e `vynkor.co/api/admin/*`. Habilitar One-time PIN como login. Permitir APENAS `lori.arteeducadora@gmail.com` e `vynkorgrappling@gmail.com`. Nao criar politica Everyone/Bypass. Duracao de sessao sugerida: 8 horas.
4. Nas variaveis de producao do Pages, configurar `ACCESS_TEAM_DOMAIN` com `https://<equipe>.cloudflareaccess.com`, `ACCESS_AUD` com o AUD dessa aplicacao e `ADMIN_EMAILS` com `lori.arteeducadora@gmail.com,vynkorgrappling@gmail.com`. Sem essas variaveis a API administrativa rejeita acesso. Ela valida assinatura, emissor, audiencia e e-mail do JWT. Mesmo no pages.dev, a API nao aceita somente o cabecalho de e-mail.
5. Alterar build do Pages para `npm run build` e diretorio de saida para `dist`. O pacote `dist/_worker.js` inclui o backend e preserva os arquivos do site via ASSETS. Nao publicar a raiz: ela contem arquivos de desenvolvimento. O build inclui apenas arquivos publicos e o Worker compilado.
6. Publicar o repositorio, verificar login dos dois e-mails, emitir um certificado de teste, ler seu QR code no telefone e cancelar esse teste. Verificar que o registro segue no historico e que a consulta mostra cancelado. Testar chamada sem JWT e com JWT adulterado no dominio e no pages.dev.

## Operacao

- Painel: https://vynkor.co/admin
- URLs publicas: https://vynkor.co/certificados/<id aleatorio de 32 caracteres>
- O professor emite, consulta, corrige, cancela e reativa sem deploy.
- Correcoes preservam o identificador. Uma nova graduacao de outro aluno exige nova emissao.
- QR codes sao gerados localmente no navegador, sem encurtador ou assinatura de terceiros. PNG de 1200px e SVG com margem de quatro modulos.
- Paginas de validacao nao sao adicionadas ao menu ou sitemap; resposta HTTP e HTML pedem noindex. Quem conhece o link pode consultar os dados publicos.
- A consulta depende da manutencao do dominio, do backend e do banco. Nao apagar o D1 nem registros ao trocar a hospedagem.
- Exportar o D1 periodicamente (`wrangler d1 export vynkor-certificates --remote --output <arquivo-seguro.sql>`) e guardar fora do repositorio publico. Manter backups e testar restauracao. O historico contem os e-mails de quem realizou alteracoes e so esta disponivel para administradores.

## Desenvolvimento

`npm ci`, `npm run build`, `npm test`, `npm run dev`.

Preview em http://127.0.0.1:8792/admin. Usa identidade fixa e banco SQLite somente no processo local ligado a 127.0.0.1. O bypass nao faz parte do Worker de producao. `npx playwright test tests/browser.spec.mjs --workers=1` testa o fluxo no Chrome instalado. `wrangler.local.jsonc` e exclusivo para migracoes D1 locais; nao usar para deploy remoto. Para testar o Worker compilado sem bypass, usar `npx wrangler pages dev dist --d1 CERTIFICATES=00000000-0000-0000-0000-000000000001 --port 8793 --ip 127.0.0.1 --compatibility-date 2026-10-30`.

Documentacao: https://developers.cloudflare.com/pages/functions/bindings/ e https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/.
