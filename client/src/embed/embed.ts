/**
 * Script para incorporar o formulário de cadastro de startups em sites externos
 */

(function() {
  // URL base da aplicação
  const baseUrl = window.location.origin;
  
  // Estilo para o iframe
  const defaultStyles = {
    width: '100%',
    maxWidth: '800px',
    height: '800px',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
  };

  // Função para criar o iframe com o formulário
  function createForm(containerId: string, options: any = {}) {
    // Buscar o elemento container
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Elemento com ID "${containerId}" não encontrado.`);
      return;
    }
    
    // Combinar opções passadas com as padrões
    const settings = {
      ...defaultStyles,
      ...options.styles || {},
    };
    
    // Criar o iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${baseUrl}/external-form-embed`;
    
    // Aplicar estilos
    Object.keys(settings).forEach(key => {
      // @ts-ignore
      iframe.style[key] = settings[key];
    });
    
    // Adicionar ao container
    container.appendChild(iframe);
    
    // Configurar mensagens entre o iframe e a página principal
    window.addEventListener('message', (event) => {
      // Verificar se a mensagem vem do nosso iframe
      if (event.source === iframe.contentWindow) {
        const { type, height } = event.data;
        
        // Redimensionar o iframe com base no conteúdo
        if (type === 'resize' && height) {
          iframe.style.height = `${height}px`;
        }
        
        // Fechar o formulário após submissão bem-sucedida
        if (type === 'formSubmitted') {
          if (options.onSubmit && typeof options.onSubmit === 'function') {
            options.onSubmit(event.data.result);
          }
        }
      }
    });
    
    return iframe;
  }

  // Expor a função globalmente
  // @ts-ignore
  window.StartupFormEmbed = { createForm };
})();