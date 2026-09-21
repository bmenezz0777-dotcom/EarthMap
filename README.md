# 🌿 Earthdance Radar — Localizador de Amigos & Barracas

Aplicação web móvel (PWA) de alta precisão para localização de amigos e barracas no festival **Earthdance**, pronta para hospedar na **Vercel** com zero configuração.

---

## 📁 Estrutura desta Pasta (100% Pronta para Subir na Web)

```
earthdance-radar/
├── api/
│   ├── ping.js                  # Rota Vercel: telemetria de GPS, IP e lista de membros
│   ├── tent.js                  # Rota Vercel: salva e atualiza a localização da barraca
│   ├── store.js                 # Gerenciador de memória com autorregeneração mútua
│   └── state.js                 # Rota Vercel: consulta geral de estado
├── index.html                   # Interface do usuário (Radar HUD, Bússola e Mapa)
├── style.css                    # Design bioluminescente temático Earthdance Festival
├── app.js                       # Controlador client-side (GPS, Bússola, Barracas, Leaflet)
├── manifest.webmanifest         # Configuração de PWA em tela cheia para celular
├── vercel.json                  # Arquivo de configuração de rotas e CORS da Vercel
├── server.js                    # Servidor local para testes no PC e Wi-Fi
└── package.json                 # Metadados do projeto
```

---

## 🚀 Como Subir na Vercel

### Opção 1: Arrastando no GitHub
1. Crie um novo repositório no [GitHub](https://github.com/new) chamado `earthdance-radar`.
2. Arraste todos os arquivos e a pasta `api/` desta pasta para o repositório.
3. Acesse a [Vercel](https://vercel.com), clique em **Add New Project**, selecione o repositório e clique em **Deploy**.

### Opção 2: Pelo Prompt de Comando (CMD)
1. Abra o CMD nesta pasta:
   ```cmd
   cd "C:\Users\breno\OneDrive\Documentos\HTML's\earthdance-radar"
   ```
2. Execute o comando da Vercel:
   ```cmd
   npx vercel
   ```
3. Faça login e aperte **Enter** para aceitar os padrões. O link público será gerado em segundos!

---

## 💻 Testar no seu Computador / Celular (Wi-Fi)
```cmd
node server.js
```
Abra no navegador: `http://localhost:3000`
