// script.js completo corrigido
let fotos = [];
let dadosUsuario = {};
let valorDisponivel = 0;
let pastaIdOneDrive = null; // Armazena o ID da pasta única do período

// =============== FUNÇÕES AUXILIARES ===============
function formatarData(dataISO) {
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

    // Atualiza interface
    document.getElementById('totalCafe').textContent = formatarMoeda(totais.cafe);
    document.getElementById('totalAlmoco').textContent = formatarMoeda(totais.almoco);
    document.getElementById('totalJanta').textContent = formatarMoeda(totais.jantar);
    document.getElementById('totalLavanderia').textContent = formatarMoeda(totais.lavanderia);
    document.getElementById('totalGeral').textContent = formatarMoeda(totais.geral);

    // Atualiza saldo
    const saldoRestante = Math.max(0, valorDisponivel - totais.geral);
    document.getElementById('saldoDisponivel').textContent = formatarMoeda(saldoRestante);
}

function atualizarPreview() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';

    // Mostra apenas fotos não enviadas
    fotos.filter(foto => foto.arquivo).forEach(foto => {
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

// =============== PERSISTÊNCIA LOCAL ===============
function salvarEstadoLocal() {
    localStorage.setItem('viagemAtual', JSON.stringify({
        dadosUsuario,
        valorDisponivel,
        fotos: fotos.map(f => ({
            ...f,
            arquivo: null, // Não salvar arquivo binário
            preview: ''    // Reduz tamanho do localStorage
        }))
    }));
}

function carregarEstadoLocal() {
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
}

// =============== ONEDRIVE (CORREÇÕES IMPLEMENTADAS) ===============
async function criarOuObterPasta(accessToken) {
    const nomePasta = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
    
    // Verifica se a pasta já existe
    let response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${nomePasta}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (response.status === 200) return await response.json();
    
    // Cria nova pasta se não existir
    response = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            name: nomePasta,
            folder: {},
            "@microsoft.graph.conflictBehavior": "rename"
        })
    });
    
    return await response.json();
}

// =============== EVENTOS PRINCIPAIS ===============
document.addEventListener('DOMContentLoaded', () => {
    carregarEstadoLocal();

    // Formulário inicial
    document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Reseta pasta ao mudar período
        const novoInicio = document.getElementById('dataInicio').value;
        const novoFim = document.getElementById('dataFim').value;
        if (dadosUsuario.dataInicio !== novoInicio || dadosUsuario.dataFim !== novoFim) {
            pastaIdOneDrive = null;
        }

        dadosUsuario = {
            nome: this.nome.value.trim(),
            dataInicio: novoInicio,
            dataFim: novoFim
        };
        valorDisponivel = parseFloat(this.valorDisponivel.value) || 0;

        // Configura datas
        const dataRegistro = document.getElementById('dataRegistro');
        dataRegistro.min = dadosUsuario.dataInicio;
        dataRegistro.max = dadosUsuario.dataFim;
        dataRegistro.value = new Date().toISOString().split('T')[0];

        // Atualiza interface
        this.style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        salvarEstadoLocal();
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
                salvarEstadoLocal();
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

        const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // ← Substitua pelo seu
        const redirectUri = 'https://meuappcontas.netlify.app'; // ← Seu domínio
        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

        const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');
        
        window.addEventListener('message', async (e) => {
            if (e.origin === window.location.origin && e.data.access_token) {
                try {
                    const accessToken = e.data.access_token;
                    
                    // 1. Criar/obter pasta única
                    const pasta = await criarOuObterPasta(accessToken);
                    
                    // 2. Enviar arquivos
                    for (const foto of fotosParaEnviar) {
                        await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pasta.id}:/${foto.nomeArquivo}:/content`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: foto.arquivo
                        });
                    }
                    
                    // 3. Remove apenas os arquivos (mantém dados)
                    fotos = fotos.map(f => ({ 
                        ...f, 
                        arquivo: null,
                        preview: ''
                    }));
                    
                    salvarEstadoLocal();
                    atualizarPreview();
                    alert('Arquivos enviados para a pasta única do período!');
                    window.open(pasta.webUrl, '_blank');
                } catch (error) {
                    alert('Erro: ' + error.message);
                } finally {
                    authWindow.close();
                }
            }
        });
    });

    // Exportação (mantido original)
    document.getElementById('btnExportExcel').addEventListener('click', () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(fotos.map(f => ({
            Categoria: f.categoria,
            Data: formatarData(f.data),
            Valor: f.valor
        })));
        XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
        XLSX.writeFile(wb, 'gastos.xlsx');
    });

    document.getElementById('btnExportPDF').addEventListener('click', () => {
        const doc = new window.jspdf.jsPDF();
        doc.text('Relatório de Gastos', 10, 10);
        fotos.forEach((foto, i) => {
            doc.text(`${foto.categoria} - ${formatarData(foto.data)} - ${formatarMoeda(foto.valor)}`, 10, 20 + (i * 10));
        });
        doc.save('gastos.pdf');
    });

    // Botão Voltar
    document.getElementById('btnVoltar').addEventListener('click', () => {
        document.getElementById('areaFotos').style.display = 'none';
        document.getElementById('formIdentificacao').style.display = 'block';
        localStorage.removeItem('viagemAtual');
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
