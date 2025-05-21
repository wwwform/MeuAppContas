let fotos = [];
let dadosUsuario = {};

// =============== FUNÇÕES AUXILIARES ===============
function formatarData(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(valor || 0);
}

function atualizarTotais() {
    let totais = {
        cafe: 0,
        almoco: 0,
        jantar: 0,
        lavanderia: 0,
        geral: 0
    };

    fotos.forEach(foto => {
        const valor = parseFloat(foto.valor);
        switch(foto.categoria) {
            case 'Café': totais.cafe += valor; break;
            case 'Almoço': totais.almoco += valor; break;
            case 'Jantar': totais.jantar += valor; break;
            case 'Lavanderia': totais.lavanderia += valor; break;
        }
        totais.geral += valor;
    });

    document.getElementById('totalCafe').textContent = formatarMoeda(totais.cafe);
    document.getElementById('totalAlmoco').textContent = formatarMoeda(totais.almoco);
    document.getElementById('totalJanta').textContent = formatarMoeda(totais.jantar);
    document.getElementById('totalLavanderia').textContent = formatarMoeda(totais.lavanderia);
    document.getElementById('totalGeral').textContent = formatarMoeda(totais.geral);
}

function atualizarPreview() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';

    fotos.forEach(foto => {
        const div = document.createElement('div');
        div.className = 'photo-preview';
        div.innerHTML = `
            <img src="${foto.preview}" alt="Comprovante">
            <div class="photo-info">
                ${foto.categoria}<br>
                ${formatarData(foto.data)}<br>
                ${formatarMoeda(foto.valor)}
            </div>
        `;
        container.appendChild(div);
    });
}

// =============== EVENTOS PRINCIPAIS ===============
document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    dadosUsuario = {
        nome: document.getElementById('nome').value.trim(),
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value
    };

    // Configurar datas
    const dataRegistro = document.getElementById('dataRegistro');
    dataRegistro.min = dadosUsuario.dataInicio;
    dataRegistro.max = dadosUsuario.dataFim;
    dataRegistro.value = new Date().toISOString().split('T')[0];

    document.getElementById('formIdentificacao').style.display = 'none';
    document.getElementById('areaFotos').style.display = 'block';
});

document.getElementById('adicionarFotoBtn').addEventListener('click', function() {
    const files = document.getElementById('inputFoto').files;
    const valor = document.getElementById('valorGasto').value;
    const data = document.getElementById('dataRegistro').value;

    if (!data || !valor || files.length === 0) {
        alert('Preencha todos os campos!');
        return;
    }

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            fotos.push({
                arquivo: file,
                preview: e.target.result,
                categoria: document.getElementById('legenda').value,
                data: data,
                valor: valor,
                nomeArquivo: `${dadosUsuario.nome.replace(/ /g, '_')}_${formatarData(data).replace(/\//g, '-')}_${Date.now()}.${file.name.split('.').pop()}`
            });
            atualizarPreview();
            atualizarTotais();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('inputFoto').value = '';
    document.getElementById('valorGasto').value = '';
});

// =============== INTEGRAÇÃO ONEDRIVE ===============
document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
    if (fotos.length === 0) {
        alert('Adicione comprovantes primeiro!');
        return;
    }

    // CONFIGURAÇÕES ONEDRIVE - PARTE CRÍTICA
    const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121';
    // Redirect URI deve ser EXATAMENTE igual ao registrado no Azure
    const redirectUri = 'https://meuappcontas.netlify.app/';
    
    // URL de autenticação correta
    const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

    // Abre janela de autenticação
    const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');

    // Aguarda token
    window.addEventListener('message', async (e) => {
        if (e.origin === window.location.origin && e.data.access_token) {
            const accessToken = e.data.access_token;
            
            // Cria pasta com nome do usuário e data
            const pasta = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
            
            try {
                // Envia arquivos
                for (const foto of fotos) {
                    const formData = new FormData();
                    formData.append('file', foto.arquivo, foto.nomeArquivo);
                    await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${pasta}/${foto.nomeArquivo}:/content`, {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${accessToken}` },
                        body: formData
                    });
                }

                alert('Arquivos salvos na pasta: ' + pasta);
                authWindow.close();
                fotos = [];
                atualizarPreview();
                atualizarTotais();
            } catch (error) {
                alert('Erro ao salvar arquivos: ' + error.message);
            }
        }
    });
});

// Captura token após autenticação
if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substr(1));
    const token = params.get('access_token');
    if (token && window.opener) {
        window.opener.postMessage({ access_token: token }, window.location.origin);
        window.close();
    }
}
