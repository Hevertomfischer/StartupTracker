/**
 * Script para incorporar o formulário de cadastro de startups em sites externos
 * StartupFormEmbed.js - v1.0.0
 */

(function() {
  // Estilo para o iframe
  const defaultStyles = {
    width: '100%',
    maxWidth: '800px',
    height: '800px',
    border: 'none',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    backgroundColor: '#fff'
  };

  // Função para criar o iframe com o formulário
  function createForm(containerId, options) {
    options = options || {};
    
    // Buscar o elemento container
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Elemento com ID "${containerId}" não encontrado.`);
      return;
    }
    
    // Obter a URL base da aplicação a partir do script ou da opção passada
    const scriptSrc = document.currentScript ? document.currentScript.src : null;
    let baseUrl = options.baseUrl;
    
    if (!baseUrl && scriptSrc) {
      // Extrair baseUrl do script de incorporação
      const urlParts = scriptSrc.split('/');
      urlParts.pop(); // Remover o nome do arquivo
      baseUrl = urlParts.join('/');
    }
    
    if (!baseUrl) {
      console.error('URL base da aplicação não encontrada. Por favor, especifique options.baseUrl.');
      return;
    }
    
    // Combinar opções passadas com as padrões
    const settings = {};
    for (const key in defaultStyles) {
      settings[key] = options.styles && options.styles[key] !== undefined 
        ? options.styles[key] 
        : defaultStyles[key];
    }
    
    // Criar o iframe
    const iframe = document.createElement('iframe');
    iframe.src = `${baseUrl}/external-form-embed`;
    
    // Aplicar estilos
    for (const key in settings) {
      iframe.style[key] = settings[key];
    }
    
    // Adicionar ao container
    container.appendChild(iframe);
    
    // Configurar mensagens entre o iframe e a página principal
    window.addEventListener('message', function(event) {
      // Verificar se a mensagem vem do nosso iframe
      if (event.source === iframe.contentWindow) {
        const data = event.data;
        
        // Redimensionar o iframe com base no conteúdo
        if (data.type === 'resize' && data.height) {
          iframe.style.height = data.height + 'px';
        }
        
        // Callback após submissão bem-sucedida
        if (data.type === 'formSubmitted') {
          if (options.onSubmit && typeof options.onSubmit === 'function') {
            options.onSubmit(data.result);
          }
        }
      }
    });
    
    return iframe;
  }

  // Expor a função globalmente
  window.StartupFormEmbed = {
    createForm: createForm,
    version: '1.0.0'
  };
})();