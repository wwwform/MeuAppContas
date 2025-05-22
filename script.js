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

    // Calcula o saldo disponível (não pode ser negativo)
    const saldoRestante = Math.max(0, valorDisponivel - totais.geral);
    atualizarSaldoDisponivel(saldoRestante);
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
    
    // Muda a cor conforme o saldo diminui
    if (valor <= valorDisponivel * 0.2) {
        saldoInfo.style.backgroundColor = '#ffebee'; // Vermelho claro
        saldoInfo.style.color = '#c62828';
    } else if (valor <= valorDisponivel * 0.5) {
        saldoInfo.style.backgroundColor = '#fff8e1'; // Amarelo claro
        saldoInfo.style.color = '#ff8f00';
    } else {
        saldoInfo.style.backgroundColor = '#e8f5e9'; // Verde claro
        saldoInfo.style.color = '#388e3c';
    }
}

// =============== EXPORTAÇÃO ===============
function exportarParaExcel() {
    const wb = XLSX.utils.book_new();
    
    // Dados do cabeçalho
    const headerData = [
        ['Controle de Gastos de Viagem'],
        ['Viajante:', dadosUsuario.nome],
        ['Período:', `${formatarData(dadosUsuario.dataInicio)} até ${formatarData(dadosUsuario.dataFim)}`],
        ['Valor Disponível:', formatarMoeda(valorDisponivel)],
        ['']
    ];
    
    // Dados da tabela de gastos
    const tableHeader = ['Categoria', 'Data', 'Valor'];
    const ws_data = [
        ...headerData,
        tableHeader
    ];
    
    // Adiciona os gastos
    fotos.forEach(foto => {
        ws_data.push([foto.categoria, formatarData(foto.data), formatarMoeda(foto.valor)]);
    });
    
    // Totais
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
    
    ws_data.push(['']);
    ws_data.push(['Total Café:', formatarMoeda(totais.cafe)]);
    ws_data.push(['Total Almoço:', formatarMoeda(totais.almoco)]);
    ws_data.push(['Total Jantar:', formatarMoeda(totais.jantar)]);
    ws_data.push(['Total Lavanderia:', formatarMoeda(totais.lavanderia)]);
    ws_data.push(['Total Geral:', formatarMoeda(totais.geral)]);
    ws_data.push(['Saldo Restante:', formatarMoeda(valorDisponivel - totais.geral)]);
    
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
    XLSX.writeFile(wb, `gastos_viagem_${dadosUsuario.nome}.xlsx`);
}

function exportarParaPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Título
    doc.setFontSize(18);
    doc.text('Controle de Gastos de Viagem', 105, 20, { align: 'center' });
    
    // Cabeçalho
    doc.setFontSize(12);
    doc.text(`Viajante: ${dadosUsuario.nome}`, 20, 35);
    doc.text(`Período: ${formatarData(dadosUsuario.dataInicio)} até ${formatarData(dadosUsuario.dataFim)}`, 20, 45);
    doc.text(`Valor Disponível: ${formatarMoeda(valorDisponivel)}`, 20, 55);
    
    // Tabela de gastos
    doc.text('Gastos Registrados:', 20, 70);
    let y = 80;
    
    // Cabeçalho tabela
    doc.setFontSize(10);
    doc.text('Categoria', 20, y);
    doc.text('Data', 70, y);
    doc.text('Valor', 120, y);
    y += 10;
    
    // Dados da tabela
    fotos.forEach(foto => {
        // Verifica se precisa de nova página
        if (y > 270) {
            doc.addPage();
            y = 20;
        }
        
        doc.text(foto.categoria, 20, y);
        doc.text(formatarData(foto.data), 70, y);
        doc.text(formatarMoeda(foto.valor), 120, y);
        y += 10;
    });
    
    // Totais
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
    
    // Nova página para resumo se necessário
    if (y > 230) {
        doc.addPage();
        y = 20;
    } else {
        y += 10;
    }
    
    // Resumo
    doc.setFontSize(12);
    doc.text('Resumo:', 20, y);
    y += 10;
    doc.text(`Total Café: ${formatarMoeda(totais.cafe)}`, 20, y); y += 10;
    doc.text(`Total Almoço: ${formatarMoeda(totais.almoco)}`, 20, y); y += 10;
    doc.text(`Total Jantar: ${formatarMoeda(totais.jantar)}`, 20, y); y += 10;
    doc.text(`Total Lavanderia: ${formatarMoeda(totais.lavanderia)}`, 20, y); y += 10;
    doc.text(`Total Geral: ${formatarMoeda(totais.geral)}`, 20, y); y += 10;
    doc.text(`Saldo Restante: ${formatarMoeda(valorDisponivel - totais.geral)}`, 20, y);
    
    doc.save(`gastos_viagem_${dadosUsuario.nome}.pdf`);
}

// =============== INICIALIZAÇÃO ===============
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa botões de exportação
    document.getElementById('btnExportExcel').addEventListener('click', exportarParaExcel);
    document.getElementById('btnExportPDF').addEventListener('click', exportarParaPDF);
    
    // Botão Voltar
    document.getElementById('btnVoltar').addEventListener('click', () => {
        document.getElementById('areaFotos').style.display = 'none';
        document.getElementById('formIdentificacao').style.display = 'block';
        document.getElementById('nome').value = dadosUsuario.nome || '';
        document.getElementById('dataInicio').value = dadosUsuario.dataInicio || '';
        document.getElementById('dataFim').value = dadosUsuario.dataFim || '';
        document.getElementById('valorDisponivel').value = valorDisponivel || '';
    });
    
    // Botão Adicionar Foto
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
                    enviado: false, // Marca como não enviado
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

    // Botão Enviar para OneDrive
    document.getElementById('enviarOneDriveBtn').addEventListener('click', async () => {
        if (fotos.length === 0) {
            alert('Adicione comprovantes primeiro!');
            return;
        }
        
        // Verifica se há fotos não enviadas
        const fotosParaEnviar = fotos.filter(foto => !foto.enviado && foto.arquivo);
        
        if (fotosParaEnviar.length === 0) {
            alert('Não há novos comprovantes para enviar!');
            return;
        }

        const clientId = '48afd123-9f72-4019-b2a1-5ccfe1d29121'; // Substitua pelo seu Client ID do Azure
        const redirectUri = 'https://meuappcontas.netlify.app'; // Substitua pelo seu domínio exato

        const authUrl = `https://login.live.com/oauth20_authorize.srf?client_id=${clientId}&scope=Files.ReadWrite&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}`;

        // Abre janela de autenticação
        const authWindow = window.open(authUrl, 'auth', 'width=600,height=800');
        if (!authWindow) {
            alert('Pop-up bloqueado! Permita pop-ups para este site.');
            return;
        }

        window.addEventListener('message', async function handler(e) {
            if (e.origin === window.location.origin && e.data.access_token) {
                window.removeEventListener('message', handler);
                const accessToken = e.data.access_token;

                try {
                    // Nome ÚNICO da pasta para este período (sem números sequenciais)
                    const pastaNome = `${dadosUsuario.nome.replace(/ /g, '_')}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;

                    // PASSO 1: Verificar se a pasta já existe
                    let folderResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${pastaNome}' and folder ne null`, {
                        headers: { 'Authorization': `Bearer ${accessToken}` }
                    });
                    
                    let folderResult = await folderResponse.json();
                    
                    // Se a pasta não existir, cria uma nova
                    if (!folderResult.value || folderResult.value.length === 0) {
                        const folderData = {
                            "name": pastaNome,
                            "folder": {},
                            "@microsoft.graph.conflictBehavior": "fail" // Não cria duplicatas
                        };
                        
                        folderResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(folderData)
                        });
                        
                        if (!folderResponse.ok) {
                            throw new Error(`Erro ao criar pasta: ${folderResponse.status}`);
                        }
                        
                        folderResult = await folderResponse.json();
                        pastaId = folderResult.id;
                    } else {
                        // Usa a pasta existente
                        pastaId = folderResult.value[0].id;
                    }
                    
                    // PASSO 2: Upload dos arquivos não enviados
                    let uploadedCount = 0;
                    for (const foto of fotosParaEnviar) {
                        const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/${foto.nomeArquivo}:/content`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: foto.arquivo
                        });

                        if (response.ok) {
                            uploadedCount++;
                            foto.enviado = true; // Marca como enviado
                        } else {
                            console.error(`Erro ao enviar ${foto.nomeArquivo}: ${response.status}`);
                        }
                    }

                    authWindow.close();
                    
                    if (uploadedCount > 0) {
                        alert(`${uploadedCount} comprovantes salvos com sucesso!`);
                        
                        // Remove fotos enviadas do array e atualiza a interface
                        fotos = fotos.filter(foto => !foto.enviado);
                        atualizarPreview();
                        atualizarTotais();
                        
                        // Abre o OneDrive para visualização
                        window.open('https://onedrive.live.com/', '_blank');
                    } else {
                        alert('Nenhum comprovante foi salvo. Verifique se há espaço suficiente no OneDrive.');
                    }
                } catch (error) {
                    alert('Erro ao salvar arquivos: ' + error.message);
                    console.error('Erro completo:', error);
                    authWindow.close();
                }
            }
        });
    });
    
    // Formulário Inicial
    document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Verifica se mudou o período - se sim, limpa as fotos
        const novoInicio = document.getElementById('dataInicio').value;
        const novoFim = document.getElementById('dataFim').value;
        
        if (dadosUsuario.dataInicio !== novoInicio || dadosUsuario.dataFim !== novoFim) {
            fotos = []; // Limpa fotos ao mudar o período
            pastaId = null; // Reseta o ID da pasta
        }

        dadosUsuario = {
            nome: document.getElementById('nome').value.trim(),
            dataInicio: novoInicio,
            dataFim: novoFim
        };

        valorDisponivel = parseFloat(document.getElementById('valorDisponivel').value) || 0;

        const dataRegistro = document.getElementById('dataRegistro');
        dataRegistro.min = dadosUsuario.dataInicio;
        dataRegistro.max = dadosUsuario.dataFim;
        dataRegistro.value = new Date().toISOString().split('T')[0];

        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        
        atualizarSaldoDisponivel(valorDisponivel);
        atualizarPreview();
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
