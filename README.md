# ☮️ Earthdance Radar — Give Peace A Dance

Localizador tático de amigos e barracas para o **Earthdance Festival**. 100% Free, zero chaves de API pagas, sem cadastros bloqueantes e pronto para deploy na **Vercel**.

---

## 🎯 Por que esta versão realmente funciona:

1. **Sincronização Híbrida (WebRTC P2P + Gossip Vercel)**:
   - Os celulares conversam diretamente entre si na pista via WebRTC.
   - Cada ping na Vercel sincroniza e repassa todos os nós conhecidos (Gossip Protocol), garantindo que ninguém se perca mesmo com reinício de containers da nuvem.
2. **Zero Chaves de API no Mapa**:
   - Utiliza OpenStreetMap livre mundial com Leaflet. Sem custos, sem limites e sem pedir cartão ou chaves de API.
3. **Registro Duplo de Barraca**:
   - **Pelo GPS**: aperte o botão "FIXAR MINHA BARRACA AQUI" quando estiver nela.
   - **Pelo Mapa**: toque em qualquer ponto do festival no mapa e clique em "SIM, FIXAR NESTE PONTO" para marcar seu acampamento de longe!
4. **Bússola Real**:
   - Suporte verificado para iPhone (iOS Safari com desbloqueio no botão) e Android (bússola absoluta + Course-Over-Ground).
   - Vibração no celular ao alinhar de frente com o alvo.

---

## 🚀 Como Fazer o Deploy na Vercel em 1 Minuto:

1. Suba os arquivos desta pasta para um repositório no seu **GitHub** (ex: `earthdance-radar`).
2. Acesse a **[Vercel](https://vercel.com)**.
3. Clique em **Add New Project**, importe o repositório e clique em **Deploy**.
4. O link público HTTPS será gerado imediatamente!

---

## 💻 Testar no seu Computador / Wi-Fi:
```cmd
node local-server.js
```
Acesse: `http://localhost:3000`
