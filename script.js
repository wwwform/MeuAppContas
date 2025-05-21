let fotos = [];
let dadosUsuario = {};

// =============== FUNÇÕES AUXILIARES ===============
function formatarData(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
    return new Intl.NumberFormat('pt-BR', { 
        style: 'currency', 
        currency: 'BRL' 
    }).format(valor);
}

function atualizarTotais() {
    let totais = {
        cafe: 0,
        almoco: 0,
        jantar: 0,
        geral: 0
    };

    fotos.forEach(foto => {
        const valor = parseFloat(foto.valor);
        switch(foto.categoria) {
            case 'Café': totais.cafe += valor; break;
            case 'Almoço': totais.almoco += valor; break;
            case 'Jantar': totais.jantar += valor; break;
        }
        totais.geral += valor;
    });

    document.getElementById('totalCafe').textContent = formatarMoeda(totais.cafe);
    document.getElementById('totalAlmoco').textContent = formatarMoeda(totais.almoco);
    document.getElementById('totalJanta').textContent = formatarMoeda(totais.jantar);
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
                ${foto.categoria} - ${formatarData(foto.data)}<br>
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

    // Ajusta limites do campo de data de registro
    const dataRegistro = document.getElementById('dataRegistro');
    dataRegistro.min = dadosUsuario.dataInicio;
    dataRegistro.max = dadosUsuario.dataFim;
    // Define data padrão como hoje (se estiver no período)
    const hoje = new Date().toISOString().split('T')[0];
    if (hoje >= dadosUsuario.dataInicio && hoje <= dadosUsuario.dataFim) {
        dataRegistro.value = hoje;
    } else {
        dataRegistro.value = dadosUsuario.dataInicio;
    }

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

// =============== ONEDRIVE (MICROSOFT GRAPH API) ===============
document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
    if (fotos.length === 0) {
        alert('Adicione comprovantes primeiro!');
        return;
    }

    // --- CONFIGURAÇÕES ---
    const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // <-- Substitua pelo seu Client ID do Azure
    const redirectUri = window.location.origin; // Ex: http://localhost:5500
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=Files.ReadWrite%20User.Read&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

    // --- AUTENTICAÇÃO ---
    const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');

    // Aguarda token
    window.addEventListener('message', function handler(e) {
        if (e.origin === window.location.origin && e.data.access_token) {
            window.removeEventListener('message', handler);
            enviarArquivos(e.data.access_token);
            authWindow.close();
        }
    });
});

// Função de envio dos arquivos para o OneDrive
async function enviarArquivos(token) {
    try {
        for (const foto of fotos) {
            await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/Expenses/${foto.nomeArquivo}:/content`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: foto.arquivo
            });
        }
        alert('Arquivos enviados com sucesso!');
        fotos = [];
        atualizarPreview();
        atualizarTotais();
    } catch (error) {
        alert('Erro ao enviar arquivos: ' + error.message);
    }
}

// Captura token após autenticação (callback)
if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substr(1));
    const token = params.get('access_token');
    if (token && window.opener) {
        window.opener.postMessage({ access_token: token }, window.location.origin);
        window.close();
    }
}
