# EstuLanches

Sistema demonstrativo de gestão de cardápio e pedidos de cantina escolar, desenvolvido com Node.js, Express, PostgreSQL e Docker.

## Requisitos
- Docker Desktop (com Docker Compose)
- Git (opcional, para publicar no GitHub)

## Executar com Docker
1. Copie `.env.example` para `.env`.
2. Altere `JWT_SECRET` e `ADMIN_PASSWORD` antes de disponibilizar o sistema.
3. Na pasta do projeto, execute:

```bash
docker compose up -d --build
```

4. Acesse http://localhost:3000.
5. Confira os serviços e os logs:

```bash
docker compose ps
docker compose logs app db
```

### Acesso inicial de administrador
Os valores padrão para uma execução local são:
- E-mail: `admin@estulanches.local`
- Senha: `Admin123!`

Altere essas credenciais no arquivo `.env` antes de qualquer uso fora de uma demonstração local. O administrador inicial é criado automaticamente na inicialização da aplicação.

## Funcionalidades
- Cadastro de estudantes e login com senha armazenada em hash bcrypt.
- Consulta pública ao cardápio.
- Cadastro, edição e desativação de produtos por administrador (API protegida; cadastro pela interface).
- Criação e consulta de pedidos.
- Atualização de status de pedidos por administrador (API protegida).
- Persistência PostgreSQL por volume Docker.

## API principal
| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/health` | Público | Saúde da aplicação e banco |
| POST | `/api/auth/register` | Público | Cadastro de estudante |
| POST | `/api/auth/login` | Público | Login |
| GET | `/api/products` | Público | Listar cardápio |
| POST | `/api/products` | Admin | Criar produto |
| PUT | `/api/products/:id` | Admin | Editar produto |
| DELETE | `/api/products/:id` | Admin | Desativar produto |
| POST | `/api/orders` | Autenticado | Criar pedido |
| GET | `/api/orders` | Autenticado | Listar pedidos próprios ou todos (admin) |
| PATCH | `/api/orders/:id/status` | Admin | Alterar status |

Para rotas protegidas, enviar `Authorization: Bearer <token>`.

## Testes
Testes unitários (não exigem banco):

```bash
npm install
npm test
```

Testes de integração (exigem PostgreSQL com o schema criado):

```bash
npm install
# Configure DATABASE_URL e JWT_SECRET no ambiente
npm run test:integration
```

Também é possível executar os testes dentro de um ambiente que tenha acesso ao banco do Compose. Os testes de integração criam e removem registros próprios.

## Comandos úteis
```bash
docker compose ps
docker compose logs -f
docker compose down
```

`docker compose down` preserva o volume do banco. Para apagar também os dados persistidos (operação destrutiva): `docker compose down -v`.

## Segurança e limitações
- Senhas armazenadas com bcrypt.
- JWT com expiração de 8 horas.
- Consultas SQL parametrizadas.
- Helmet e limite de tamanho do JSON.
- Segredos configuráveis por variáveis de ambiente.
- Projeto didático: para produção real, adicionar HTTPS, rate limiting, política CORS restritiva, gestão segura de segredos, backups testados, observabilidade, proteção contra abuso e revisão de autorização/fluxos.

## Implantação e RDM
A ficha RDM deve ser preenchida após a implantação real, com data, horário, versão, parâmetros efetivamente utilizados e resultados observados nos testes. Não registre testes como aprovados antes de executá-los.
