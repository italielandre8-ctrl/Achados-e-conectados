# Achados e Conectados

Site escolar para registrar objetos encontrados, permitir que a direção aprove publicações e receber solicitações privadas de alunos.

## Arquivos
- `index.html` — estrutura das páginas
- `style.css` — aparência para celular e computador
- `app.js` — funcionalidades e conexão com Firebase

## Importante
Sem configurar o Firebase, o site funciona apenas em modo de demonstração no navegador atual. Os dados não são compartilhados entre celulares e computadores.

## Configuração do Firebase
1. Acesse https://console.firebase.google.com/
2. Crie um projeto.
3. Adicione um aplicativo Web e copie a configuração.
4. No arquivo `app.js`, substitua os valores `COLOQUE_...` pelos valores reais do projeto.
5. Ative Authentication com e-mail e senha.
6. Crie uma conta para a direção.
7. Configure Firestore Database e Storage.
8. Peça a um adulto responsável ou técnico para revisar as regras de segurança antes de usar o site na escola.

## Como usar
### Aluno
1. Escolha "Sou aluno".
2. Envie foto, descrição e local do objeto.
3. Procure os objetos que a direção publicou.
4. Se reconhecer um objeto, envie seu nome e uma informação privada para ajudar na identificação.

### Direção
1. Entre com uma conta autorizada.
2. Analise os objetos enviados.
3. Publique ou recuse os envios.
4. Confira as solicitações de retirada.
5. Remova do mural os objetos devolvidos.

## Notificações
Nesta versão, as solicitações aparecem no painel da direção quando ele é carregado. Notificações automáticas por e-mail ou celular exigem configuração adicional.
