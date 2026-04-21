# Instruções de Deploy na e2-micro

Para rodar esta aplicação em um servidor Google Cloud Compute Engine `e2-micro` (1GB RAM), siga os passos abaixo:

### 1. Preparar o Ambiente
Certifique-se de ter Node.js (v18+) instalado. Instale o PM2 globalmente:
```bash
npm install -g pm2
```

### 2. Instalar Dependências e Build
No diretório raiz do projeto:
```bash
npm install
npm run build
```

### 3. Iniciar com PM2 (Otimizado para Memória)
Use o comando abaixo para iniciar o Next.js com o limite de memória configurado para 512MB, garantindo estabilidade na e2-micro:

```bash
pm2 start npm --name "prospector-app" --node-args="--max-old-space-size=512" -- start
```

### 4. Monitoramento
Para acompanhar o uso de recursos:
```bash
pm2 monit
```

### 5. Configurar Cron Externo
No Google Cloud Scheduler, crie um job:
- **Frequência:** `*/10 * * * *` (cada 10 minutos)
- **Target:** HTTP
- **URL:** `https://seu-dominio.com/api/cron`
- **Método:** GET ou POST
