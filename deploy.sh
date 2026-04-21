#!/bin/bash

# Script de Deploy e Inicialização para e2-micro (1GB RAM)
# Este script otimiza o uso de memória durante o build e execução do app.

echo "🚀 Iniciando processo de Deploy..."

# 1. Garantir que as dependências estão instaladas
echo "📦 Instalando/Verificando dependências..."
npm install

# 2. Executar o Build com limite de 1024MB (para não travar a VM)
echo "🏗️  Executando Build..."
NODE_OPTIONS="--max-old-space-size=1024" npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build concluído com sucesso!"
else
    echo "❌ Erro no Build. Verifique se há memória SWAP configurada na VM."
    exit 1
fi

# 3. Reiniciar ou Iniciar o PM2
echo "⚙️  Configurando gerenciador de processos PM2..."

# Tenta deletar o processo antigo se existir para evitar duplicatas, senão ignora erro
pm2 delete prospector 2>/dev/null || true

# Inicia o app com limite de 512MB para o runtime (sobrando 512MB para o sistema)
echo "🟢 Iniciando aplicação..."
pm2 start npm --name "prospector" --node-args="--max-old-space-size=512" -- start

# 4. Salvar configuração do PM2 para persistir após reboot da VM
pm2 save

echo "----------------------------------------------------"
echo "✨ TUDO PRONTO! Seu Prospector está rodando no PM2."
echo "Use 'pm2 logs prospector' para ver os logs em tempo real."
echo "----------------------------------------------------"
