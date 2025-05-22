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
    saldoInfo.style.backgroundColor = valor <= valorDisponivel * 0.2 ? '#ffebee' :
                                    valor <= valorDisponivel * 0.5 ? '#fff8e1' : '#e8f5e9';
    saldoInfo.style.color = valor <= valorDisponivel * 0.2 ? '#c62828' :
                          valor <= valorDisponivel * 0.5 ? '#ff8f00' : '#388e3c';
}

// =============== EVENTOS PRINCIPAIS ===============
document.addEventListener('DOMContentLoaded', () => {
    // Carrega estado salvo
    const savedData = localStorage.getItem('viagemAtual');
    if (savedData) {
        const { dados, valor, fotos: savedFotos } = JSON.parse(savedData);
        dadosUsuario = dados;
        valorDisponivel = valor;
        fotos = savedFotos;
        
        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        atualizarSaldoDisponivel(valorDisponivel);
        atualizarPreview();
        atualizarTotais();
    }

    // Evento de formulário
    document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const dataInicio = document.getElementById('dataInicio').value;
        const dataFim = document.getElementById('dataFim').value;
        
        // Reseta ao mudar período
        if (dadosUsuario && (dadosUsuario.dataInicio !== dataInicio || dadosUsuario.dataFim !== dataFim)) {
            fotos = [];
            localStorage.removeItem('viagemAtual');
        }

        dadosUsuario = {
            nome: document.getElementById('nome').value.trim(),
            dataInicio: dataInicio,
            dataFim: dataFim
        };

        valorDisponivel = parseFloat(document.getElementById('valorDisponivel').value) || 0;

        document.getElementById('dataRegistro').min = dataInicio;
        document.getElementById('dataRegistro').max = dataFim;
        document.getElementById('dataRegistro').value = new Date().toISOString().split('T')[0];

        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        atualizarSaldoDisponivel(valorDisponivel);
        localStorage.setItem('viagemAtual', JSON.stringify({ dados: dadosUsuario, valor: valorDisponivel, fotos }));
    });

    // Botão Voltar
    document.getElementById('btnVoltar').addEventListener('click', () => {
        document.getElementById('areaFotos').style.display = 'none';
        document.getElementById('formIdentificacao').style.display = 'block';
        localStorage.removeItem('viagemAtual');
    });

    // Adicionar Foto
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
                localStorage.setItem('viagemAtual', JSON.stringify({ dados: dadosUsuario, valor: valorDisponivel, fotos }));
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

        const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121';
        const redirectUri = 'https://meuappcontas.netlify.app';
        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

        const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');
        
        window.addEventListener('message', async (e) => {
            if (e.origin === window.location.origin && e.data.access_token) {
                try {
                    const accessToken = e.data.access_token;
                    
                    // Criar/obter pasta
                    const pastaNome = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
                    let pasta = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root:/${pastaNome}`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    
                    if (pasta.status === 404) {
                        pasta = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
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
                    }
                    const pastaData = await pasta.json();
                    
                    // Enviar arquivos
                    for (const foto of fotosParaEnviar) {
                        await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaData.id}:/${foto.nomeArquivo}:/content`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: foto.arquivo
                        });
                    }

                    // Remove apenas os arquivos de imagem
                    fotos = fotos.map(f => ({ ...f, arquivo: null, preview: '' }));
                    localStorage.setItem('viagemAtual', JSON.stringify({ dados: dadosUsuario, valor: valorDisponivel, fotos }));
                    
                    alert('Fotos enviadas com sucesso!');
                    atualizarPreview();
                } catch (error) {
                    alert('Erro: ' + error.message);
                } finally {
                    authWindow.close();
                }
            }
        });
    });

    // Exportação
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
});
