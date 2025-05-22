let fotos = [];
let dadosUsuario = {};
let valorDisponivel = 0;
let pastaId = null;

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
    let totais = { cafe: 0, almoco: 0, jantar: 0, lavanderia: 0, geral: 0 };
    
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

    const saldo = Math.max(0, valorDisponivel - totais.geral);
    atualizarSaldoDisponivel(saldo);
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

function atualizarSaldoDisponivel(valor) {
    const saldoInfo = document.getElementById('saldoInfo');
    saldoInfo.innerHTML = `Saldo disponível: ${formatarMoeda(valor)}`;
    saldoInfo.style.backgroundColor = valor <= valorDisponivel * 0.2 ? '#ffebee' :
                                    valor <= valorDisponivel * 0.5 ? '#fff8e1' : '#e8f5e9';
    saldoInfo.style.color = valor <= valorDisponivel * 0.2 ? '#c62828' :
                          valor <= valorDisponivel * 0.5 ? '#ff8f00' : '#388e3c';
}

// =============== PERSISTÊNCIA LOCAL ===============
function salvarEstado() {
    const estado = {
        dadosUsuario,
        valorDisponivel,
        fotos: fotos.map(f => ({ ...f, arquivo: null, preview: '' })) // Remove dados binários
    };
    localStorage.setItem('viagemAtual', JSON.stringify(estado));
}

// =============== ONEDRIVE ===============
async function criarObterPasta(accessToken) {
    const pastaNome = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
    
    // Verifica se a pasta já existe
    let response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${pastaNome}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (response.ok) return await response.json();
    
    // Cria nova pasta
    response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: pastaNome,
            folder: {},
            "@microsoft.graph.conflictBehavior": "rename"
        })
    });
    
    return await response.json();
}

// =============== EVENTOS PRINCIPAIS ===============
document.addEventListener('DOMContentLoaded', () => {
    // Carregar estado salvo
    const saved = localStorage.getItem('viagemAtual');
    if (saved) {
        const estado = JSON.parse(saved);
        dadosUsuario = estado.dadosUsuario;
        valorDisponivel = estado.valorDisponivel;
        fotos = estado.fotos;
        
        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        atualizarPreview();
        atualizarTotais();
    }

    // Formulário inicial
    document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
        e.preventDefault();
        
        dadosUsuario = {
            nome: this.nome.value.trim(),
            dataInicio: this.dataInicio.value,
            dataFim: this.dataFim.value
        };
        
        valorDisponivel = parseFloat(this.valorDisponivel.value) || 0;
        
        // Configura datas
        const dataRegistro = document.getElementById('dataRegistro');
        dataRegistro.min = dadosUsuario.dataInicio;
        dataRegistro.max = dadosUsuario.dataFim;
        dataRegistro.value = new Date().toISOString().split('T')[0];
        
        // Transição de tela
        this.style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        salvarEstado();
    });

    // Adicionar foto
    document.getElementById('adicionarFotoBtn').addEventListener('click', () => {
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
                    nomeArquivo: `${dadosUsuario.nome}_${Date.now()}_${file.name}`
                });
                atualizarPreview();
                atualizarTotais();
                salvarEstado();
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('inputFoto').value = '';
        document.getElementById('valorGasto').value = '';
    });

    // Enviar para OneDrive
    document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
        const fotosParaEnviar = fotos.filter(f => f.arquivo);
        if (fotosParaEnviar.length === 0) {
            alert('Adicione comprovantes primeiro!');
            return;
        }

        const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // ← Seu Client ID do Azure
        const redirectUri = 'https://meuappcontas.netlify.app/'; // ← Seu domínio
        
        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;
        const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');

        window.addEventListener('message', async (e) => {
            if (e.origin === window.location.origin && e.data.access_token) {
                try {
                    const accessToken = e.data.access_token;
                    
                    // 1. Criar/obter pasta
                    const pasta = await criarObterPasta(accessToken);
                    
                    // 2. Enviar arquivos
                    for (const foto of fotosParaEnviar) {
                        await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pasta.id}:/${foto.nomeArquivo}:/content`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: foto.arquivo
                        });
                    }
                    
                    // 3. Atualizar estado (remove arquivos, mantém dados)
                    fotos = fotos.map(f => ({ ...f, arquivo: null, preview: '' }));
                    salvarEstado();
                    atualizarPreview();
                    
                    alert('Fotos enviadas com sucesso!');
                    window.open(pasta.webUrl, '_blank');
                } catch (error) {
                    alert('Erro: ' + error.message);
                } finally {
                    authWindow.close();
                }
            }
        });
    });
});
