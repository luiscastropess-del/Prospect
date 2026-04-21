# Instruções de Deploy na e2-micro

Para rodar esta aplicação em um servidor Google Cloud Compute Engine `e2-micro` (1GB RAM), siga os passos abaixo:

### 0. Configurar SWAP (CRÍTICO para 1GB RAM)
Antes de qualquer coisa, execute o script de SWAP para garantir que o build não trave:
```bash
sudo chmod +x setup_swap.sh && sudo ./setup_swap.sh
```

### 1. Configurar Banco de Dados (Supabase)
Como mudamos para o Supabase SDK, você precisa criar a tabela manualmente uma única vez no **SQL Editor** do seu painel Supabase:

```sql
CREATE TABLE IF NOT EXISTS places (
  osm_id TEXT PRIMARY KEY,
  name TEXT,
  category TEXT,
  address TEXT,
  opening_hours TEXT,
  phone TEXT,
  website TEXT,
  photo_url TEXT,
  rating TEXT,
  last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Habilitar RLS (Opcional por enquanto, mas recomendado para segurança)
-- ALTER TABLE places ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Permitir leitura pública" ON places FOR SELECT USING (true);
-- CREATE POLICY "Permitir inserção via Anon Key" ON places FOR INSERT WITH CHECK (true);
```

### 2. Preparar o Ambiente
Certifique-se de ter Node.js (v20+) instalado. Instale o PM2 globalmente:
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

### 5. Configurar Cron Externo (via cron-job.org)
Como alternativa gratuita e simples, você pode usar o **cron-job.org** para acionar a API a cada 10 minutos:

1. Acesse [cron-job.org](https://cron-job.org) e crie uma conta gratuita.
2. Clique em **"Create cronjob"** no seu painel.
3. Preencha os campos:
   - **Title:** Prospector de Locais Cron
   - **URL:** `http://34.151.205.86:3000/api/cron` (ou seu domínio se tiver configurado)
   - **Execution schedule:** Selecione `User-defined` e marque para rodar a cada **10 minutos** (selecione todos os dias e meses).
   - Na aba "Advanced", verifique se o **Method** está como `GET`.
4. Clique em **"Create"**. 

Pronto! O cron-job.org fará uma chamada (ping) nesse endpoint automaticamente, alimentando seu banco de dados de maneira passiva.