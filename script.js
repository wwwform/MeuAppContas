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
    }).format(valor || 0);
}

function atualizarTotais() {
    let totais = { cafe: 0, almoco: 0, jantar: 0, geral: 0 };
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

// =============== INICIALIZAÇÃO ===============
document.addEventListener('DOMContentLoaded', () => {
    // Carrega dados do localStorage
    const dadosSalvos = localStorage.getItem('dadosUsuario');
    if (dadosSalvos) {
        dadosUsuario = JSON.parse(dadosSalvos);
        exibirResumoUsuario();
    }
});

function exibirResumoUsuario() {
    const resumo = document.createElement('div');
    resumo.className = 'resumo-usuario';
    resumo.innerHTML = `
        <h3>📋 Resumo da Viagem</h3>
        <p><strong>Viajante:</strong> ${dadosUsuario.nome}</p>
        <p><strong>Período:</strong> ${formatarData(dadosUsuario.dataInicio)} a ${formatarData(dadosUsuario.dataFim)}</p>
    `;
    document.body.insertBefore(resumo, document.querySelector('.container'));
}

// =============== FORMULÁRIO INICIAL ===============
document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    dadosUsuario = {
        nome: document.getElementById('nome').value.trim(),
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value
    };

    // Salva no localStorage e exibe resumo
    localStorage.setItem('dadosUsuario', JSON.stringify(dadosUsuario));
    exibirResumoUsuario();
    
    // Configura datas
    const dataRegistro = document.getElementById('dataRegistro');
    dataRegistro.min = dadosUsuario.dataInicio;
    dataRegistro.max = dadosUsuario.dataFim;
    dataRegistro.value = new Date().toISOString().split('T')[0];

    document.getElementById('formIdentificacao').style.display = 'none';
    document.getElementById('areaFotos').style.display = 'block';
});

// =============== ADICIONAR FOTOS ===============
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

// =============== ONEDRIVE (PERSISTÊNCIA MULTIDISPOSITIVO) ===============
document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
    if (fotos.length === 0) {
        alert('Adicione comprovantes primeiro!');
        return;
    }

    // 1. Autenticação
    const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // Seu Client ID
    const redirectUri = 'https://meuappcontas.netlify.app/'; // Altere para seu domínio
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
    const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');

    // 2. Salva dados do usuário no OneDrive após autenticação
    window.addEventListener('message', async e => {
        if (e.origin === window.location.origin && e.data.access_token) {
            const accessToken = e.data.access_token;
            
            // Envia comprovantes
            for (const foto of fotos) {
                const formData = new FormData();
                formData.append('file', foto.arquivo, foto.nomeArquivo);
                await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/Expenses/${foto.nomeArquivo}:/content`, {
                    method: 'PUT',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    body: formData
                });
            }

            // Salva dados do usuário em arquivo JSON no OneDrive
            const userDataFile = new Blob([JSON.stringify(dadosUsuario)], { type: 'application/json' });
            await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/Expenses/user_data.json:/content`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: userDataFile
            });

            alert('Dados salvos com sucesso no OneDrive!');
            authWindow.close();
        }
    });
});

// 3. Carrega dados do usuário do OneDrive ao logar
if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substr(1));
    const token = params.get('access_token');
    
    fetch('https://graph.microsoft.com/v1.0/me/drive/root:/Expenses/user_data.json:/content', {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        localStorage.setItem('dadosUsuario', JSON.stringify(data));
        window.opener.postMessage({ access_token: token }, window.location.origin);
        window.close();
    });
}
