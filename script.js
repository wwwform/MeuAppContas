let fotos = [];
let dadosUsuario = {};
let valorDisponivel = 0;
let pastaId = null;

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

    const saldoRestante = Math.max(0, valorDisponivel - totais.geral);
    atualizarSaldoDisponivel(saldoRestante);
}

function atualizarPreview() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';

    fotos.filter(foto => foto.arquivo).forEach(foto => {
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
    
    if (valor <= valorDisponivel * 0.2) {
        saldoInfo.style.backgroundColor = '#ffebee';
        saldoInfo.style.color = '#c62828';
    } else if (valor <= valorDisponivel * 0.5) {
        saldoInfo.style.backgroundColor = '#fff8e1';
        saldoInfo.style.color = '#ff8f00';
    } else {
        saldoInfo.style.backgroundColor = '#e8f5e9';
        saldoInfo.style.color = '#388e3c';
    }
}

// =============== PERSISTÊNCIA LOCAL ===============
function salvarEstadoLocal() {
    const estado = {
        dadosUsuario,
        valorDisponivel,
        fotos: fotos.map(f => ({
            ...f,
            arquivo: null, // Não salva o arquivo no localStorage
            preview: ''    // Limpa preview para economizar espaço
        }))
    };
    localStorage.setItem('viagemAtual', JSON.stringify(estado));
}

function carregarEstadoLocal() {
    const dados = localStorage.getItem('viagemAtual');
    if (dados) {
        const estado = JSON.parse(dados);
        dadosUsuario = estado.dadosUsuario;
        valorDisponivel = estado.valorDisponivel;
        fotos = estado.fotos;
        
        // Restaura campos do formulário
        document.getElementById('nome').value = dadosUsuario.nome;
        document.getElementById('dataInicio').value = dadosUsuario.dataInicio;
        document.getElementById('dataFim').value = dadosUsuario.dataFim;
        document.getElementById('valorDisponivel').value = valorDisponivel;
        
        // Atualiza interface
        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        atualizarSaldoDisponivel(valorDisponivel);
        atualizarTotais();
    }
}

// =============== EXPORTAÇÃO ===============
function exportarParaExcel() {
    const wb = XLSX.utils.book_new();
    const ws_data = [['Categoria', 'Data', 'Valor']];
    fotos.forEach(foto => {
        ws_data.push([foto.categoria, formatarData(foto.data), foto.valor]);
    });
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `gastos_${dadosUsuario.nome}.xlsx`);
}

function exportarParaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text('Relatório de Gastos', 10, 10);
    let y = 20;
    fotos.forEach(foto => {
        doc.text(`${foto.categoria} - ${formatarData(foto.data)} - ${formatarMoeda(foto.valor)}`, 10, y);
        y += 10;
    });
    doc.save(`gastos_${dadosUsuario.nome}.pdf`);
}

// =============== INTEGRAÇÃO ONEDRIVE ===============
async function criarObterPasta(accessToken) {
    const pastaNome = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
    
    // Verifica se a pasta já existe
    const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${pastaNome}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    
    if (response.status === 200) {
        return await response.json(); // Retorna pasta existente
    }
    
    // Cria nova pasta se não existir
    const folderData = {
        "name": pastaNome,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail"
    };
    
    const createResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(folderData)
    });
    
    return await createResponse.json();
}

async function enviarFotosParaPasta(accessToken, pasta) {
    const fotosParaEnviar = fotos.filter(f => f.arquivo);
    
    for (const foto of fotosParaEnviar) {
        const formData = new FormData();
        formData.append('file', foto.arquivo, foto.nomeArquivo);
        
        await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pasta.id}:/${foto.nomeArquivo}:/content`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: formData
        });
    }
    
    // Remove apenas os arquivos de foto após envio
    fotos = fotos.map(f => ({ ...f, arquivo: null, preview: '' }));
}

// =============== EVENTOS PRINCIPAIS ===============
document.addEventListener('DOMContentLoaded', () => {
    // Carrega estado salvo
    carregarEstadoLocal();

    // Configura botões
    document.getElementById('btnExportExcel').addEventListener('click', exportarParaExcel);
    document.getElementById('btnExportPDF').addEventListener('click', exportarParaPDF);

    document.getElementById('btnVoltar').addEventListener('click', () => {
        salvarEstadoLocal();
        location.reload(); // Recarrega para limpar estado
    });

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

    document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
        if (fotos.filter(f => f.arquivo).length === 0) {
            alert('Adicione comprovantes primeiro!');
            return;
        }

        const clientId = 'SEU_CLIENT_ID_AQUI';
        const redirectUri = 'https://seusite.netlify.app';
        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

        const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');
        
        window.addEventListener('message', async (e) => {
            if (e.origin === window.location.origin && e.data.access_token) {
                try {
                    const accessToken = e.data.access_token;
                    
                    // 1. Criar/obter pasta
                    const pasta = await criarObterPasta(accessToken);
                    
                    // 2. Enviar fotos
                    await enviarFotosParaPasta(accessToken, pasta);
                    
                    // 3. Atualizar interface
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

    document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Limpa dados ao mudar período
        if (dadosUsuario.dataInicio !== this.dataInicio.value || dadosUsuario.dataFim !== this.dataFim.value) {
            fotos = [];
            localStorage.removeItem('viagemAtual');
        }

        dadosUsuario = {
            nome: this.nome.value.trim(),
            dataInicio: this.dataInicio.value,
            dataFim: this.dataFim.value
        };

        valorDisponivel = parseFloat(this.valorDisponivel.value) || 0;

        document.getElementById('dataRegistro').min = dadosUsuario.dataInicio;
        document.getElementById('dataRegistro').max = dadosUsuario.dataFim;
        document.getElementById('dataRegistro').value = new Date().toISOString().split('T')[0];

        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        atualizarSaldoDisponivel(valorDisponivel);
        salvarEstadoLocal();
    });
});

// Finalização
if (window.location.hash.includes('access_token')) {
    const params = new URLSearchParams(window.location.hash.substr(1));
    const token = params.get('access_token');
    if (token && window.opener) {
        window.opener.postMessage({ access_token: token }, window.location.origin);
        window.close();
    }
}
