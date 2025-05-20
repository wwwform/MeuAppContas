// Armazena os dados das fotos
let fotos = [];
let dadosUsuario = {};

// Evento de envio do formulário inicial
document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Coletar dados do formulário
    dadosUsuario = {
        nome: document.getElementById('nome').value,
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value
    };

    // Mostrar área de fotos
    document.getElementById('formIdentificacao').style.display = 'none';
    document.getElementById('areaFotos').style.display = 'block';
});

// Função para formatar data no padrão dd/mm/aaaa
function formatarData(inputDate) {
    const date = new Date(inputDate);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const ano = date.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

// Modificação no evento de adicionar foto
document.getElementById('adicionarFotoBtn').addEventListener('click', function() {
    const dataRegistro = document.getElementById('dataRegistro').value;
    
    if (!dataRegistro) {
        alert('Selecione a data do gasto!');
        return;
    }

    const input = document.getElementById('inputFoto');
    const files = input.files;
    
    if (files.length > 0) {
        Array.from(files).forEach(file => {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                const fotoData = {
                    arquivo: file,
                    preview: e.target.result,
                    categoria: document.getElementById('legenda').value,
                    data: document.getElementById('dataRegistro').value,
                    nomeArquivo: `${dadosUsuario.nome.replace(/\s/g, '_')}_${
                        formatarData(document.getElementById('dataRegistro').value).replace(/\//g, '-')
                    }_${Date.now()}.${file.name.split('.').pop()}`
                };

                fotos.push(fotoData);
                atualizarListaFotos();
            };
            
            reader.readAsDataURL(file);
        });
    }
});


// Atualiza a pré-visualização das fotos
function atualizarListaFotos() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';
    
    fotos.forEach((foto, index) => {
        const div = document.createElement('div');
        div.className = 'photo-preview';
        div.innerHTML = `
            <img src="${foto.preview}" alt="Preview">
            <div class="photo-info">
                <small>${foto.categoria} - ${foto.data}</small>
            </div>
        `;
        container.appendChild(div);
    });
}

// Upload para o OneDrive (Implementação básica)
document.getElementById('enviarOneDriveBtn').addEventListener('click', async function() {
    try {
        // Autenticação no Microsoft Graph (substitua com suas credenciais)
        const clientId = 'SEU_CLIENT_ID_AQUI';
        const redirectUri = 'http://localhost:5500'; // Altere para seu domínio
        
        // Iniciar fluxo OAuth
        const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=Files.ReadWrite`;
        
        // Redirecionar para autenticação
        window.location.href = authUrl;
        
        // Após autenticação bem-sucedida (implementar lógica de callback)
        // Upload de cada arquivo
        for (const foto of fotos) {
            const formData = new FormData();
            formData.append('file', foto.arquivo, foto.nomeArquivo);
            
            // Requisição para a API do OneDrive
            await fetch('https://graph.microsoft.com/v1.0/me/drive/root:/Expenses/' + foto.nomeArquivo + ':/content', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                },
                body: formData
            });
        }
        
        alert('Arquivos enviados com sucesso!');
        fotos = [];
        atualizarListaFotos();
    } catch (error) {
        console.error('Erro no upload:', error);
        alert('Erro ao enviar arquivos!');
    }
});
