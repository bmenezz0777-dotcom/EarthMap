# ☮️ Earthdance Radar — RS 2026

Localizador mobile-first de amigos e barracas para o **Earthdance Festival**. Mapa livre, GPS, bússola e PWA sem cadastro obrigatório, pronto para deploy na **Vercel**.

---

## 🎯 Por que esta versão realmente funciona:

1. **Radar e navegação no celular**:
   - GPS, bússola e vibração orientam a pessoa até uma barraca ou amigo selecionado.
   - A interface prioriza ações grandes, contraste e leitura rápida em ambiente externo.
2. **Zero Chaves de API no Mapa**:
   - Utiliza OpenStreetMap livre mundial com Leaflet. Sem custos, sem limites e sem pedir cartão ou chaves de API.
3. **Registro Duplo de Barraca**:
   - **Pelo GPS**: aperte o botão "FIXAR MINHA BARRACA AQUI" quando estiver nela.
   - **Pelo Mapa**: toque em qualquer ponto do festival no mapa e clique em "SIM, FIXAR NESTE PONTO" para marcar seu acampamento de longe!
4. **Bússola Real**:
   - Suporte verificado para iPhone (iOS Safari com desbloqueio no botão) e Android (bússola absoluta + Course-Over-Ground).
   - Vibração no celular ao alinhar de frente com o alvo.

---

## 🚀 Deploy na Vercel

1. Suba os arquivos desta pasta para um repositório no seu **GitHub** (ex: `earthdance-radar`).
2. Acesse a **[Vercel](https://vercel.com)**.
3. Clique em **Add New Project**, importe o repositório e clique em **Deploy**.
4. O link público HTTPS será gerado imediatamente. As funções em `api/` são detectadas automaticamente.

> **Nota de operação:** o diretório de pessoas/barracas desta versão usa memória efêmera da função. É apropriado para demonstração e testes locais; uma edição de produção para um festival deve conectar `api/store.js` a uma base com expiração (por exemplo, Vercel KV) e definir uma política de retenção/consentimento para coordenadas.

---

## 💻 Testar no seu Computador / Wi-Fi:
```cmd
node local-server.js
```
Acesse: `http://localhost:3000`
