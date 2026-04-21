#!/bin/bash

# Script para criar um arquivo de SWAP de 2GB fixo
# ESSENCIAL para máquinas e2-micro (1GB RAM) não travarem no 'next build'
# Nota: Este script deve ser executado com privilégios de ROOT (sudo) na sua VM do Google Cloud.

if [ "$EUID" -ne 0 ]; then
  echo "❌ Erro: Este script precisa ser executado como root. Tente: sudo ./setup_swap.sh"
  exit 1
fi

echo "🔍 Verificando se já existe SWAP ativo..."
SWAP_EXISTS=$(free | grep -i swap | awk '{print $2}')

if [ "$SWAP_EXISTS" -gt 0 ]; then
    echo "⚠️  SWAP já detectado ($SWAP_EXISTS bytes). Pulando criação."
else
    echo "💾 Criando arquivo de SWAP de 2G (Isso pode demorar alguns segundos)..."
    # Tenta usar fallocate (mais rápido), senão usa dd
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    
    echo "🔒 Configurando permissões de segurança..."
    chmod 600 /swapfile
    
    echo "🛠️  Formatando arquivo como swap..."
    mkswap /swapfile
    
    echo "🚀 Ativando o arquivo de SWAP..."
    swapon /swapfile
    
    echo "📌 Adicionando ao /etc/fstab para persistência após reinicialização..."
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    
    echo "✅ SWAP de 2GB configurado e ativado!"
fi

echo "📊 Resumo da memória do seu servidor:"
free -h

echo "--------------------------------------------------------"
echo "Pronto! Agora você pode rodar 'npm run build' sem medo."
echo "--------------------------------------------------------"
