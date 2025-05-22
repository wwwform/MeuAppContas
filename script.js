let fotos = [];
let dadosUsuario = {};
let valorDisponivel = 0;
let pastaId = null; // ID da pasta da viagem no OneDrive
let accessToken = null; // Token de autenticação do OneDrive

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

    atualizarSaldoDisponivel(valorDisponivel - totais.geral);
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

function atualizarSaldoDisponivel(valorRestante) {
    const saldoAtual = Math.max(0, valorRestante);
    const saldoInfo = document.getElementById('saldoInfo');
    saldoInfo.innerHTML = `Saldo disponível: ${formatarMoeda(saldoAtual)}`;
    
    // Muda a cor conforme o saldo diminui
    if (saldoAtual <= valorDisponivel * 0.2) {
        saldoInfo.style.backgroundColor = '#ffebee'; // Vermelho claro
        saldoInfo.style.color = '#c62828';
    } else if (saldoAtual <= valorDisponivel * 0.5) {
        saldoInfo.style.backgroundColor = '#fff8e1'; // Amarelo claro
        saldoInfo.style.color = '#ff8f00';
    } else {
        saldoInfo.style.backgroundColor = '#e8f5e9'; // Verde claro
        saldoInfo.style.color = '#388e3c';
    }
}

// =============== PERSISTÊNCIA DE DADOS ===============
function salvarDadosLocalStorage() {
    const dadosSalvos = {
        dadosUsuario,
        valorDisponivel,
        fotos: fotos.map(f => {
            // Não armazenamos fotos completas no localStorage (ficaria muito grande)
            // mas guardamos os dados para reconstruir fotos salvas no OneDrive
            return {
                categoria: f.categoria,
                data: f.data,
                valor: f.valor,
                nomeArquivo: f.nomeArquivo
            };
        })
    };
    
    localStorage.setItem('viagemAtual', JSON.stringify(dadosSalvos));
}

function carregarDadosLocalStorage() {
    const dadosSalvos = localStorage.getItem('viagemAtual');
    if (dadosSalvos) {
        const dados = JSON.parse(dadosSalvos);
        dadosUsuario = dados.dadosUsuario;
        valorDisponivel = dados.valorDisponivel;
        
        // Carregamos apenas os metadados das fotos, sem as imagens
        fotos = dados.fotos;
        
        return true;
    }
    return false;
}

// =============== EXPORTAÇÃO ===============
function exportarParaExcel() {
    const { jspdf: { jsPDF } } = window.jspdf;
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

// =============== HISTÓRICO NO ONEDRIVE ===============
async function salvarHistoricoOneDrive(accessToken) {
    // Nome da pasta no formato desejado: Nome_DD-MM-AAAA
    const pastaNome = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
    
    try {
        // PASSO 1: Criar ou obter pasta
        let folderResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${pastaNome}' and folder ne null`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        let folderData = await folderResponse.json();
        
        // Se a pasta não existe, cria
        if (!folderData.value || folderData.value.length === 0) {
            const folderPayload = {
                "name": pastaNome,
                "folder": {},
                "@microsoft.graph.conflictBehavior": "rename"
            };
            
            folderResponse = await fetch('https://graph.microsoft.com/v1.0/me/drive/root/children', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(folderPayload)
            });
            
            if (!folderResponse.ok) {
                throw new Error(`Erro ao criar pasta: ${folderResponse.status}`);
            }
            
            folderData = await folderResponse.json();
            pastaId = folderData.id;
        } else {
            pastaId = folderData.value[0].id;
        }
        
        // PASSO 2: Salvar arquivo de histórico
        const historico = {
            dadosUsuario,
            valorDisponivel,
            fotos: fotos.map(f => ({
                categoria: f.categoria,
                data: f.data,
                valor: f.valor,
                nomeArquivo: f.nomeArquivo
            }))
        };
        
        const historicoBlob = new Blob([JSON.stringify(historico)], { type: 'application/json' });
        const historicoResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/historico.json:/content`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${accessToken}` },
            body: historicoBlob
        });
        
        if (!historicoResponse.ok) {
            throw new Error('Erro ao salvar histórico');
        }
        
        return pastaId;
    } catch (error) {
        console.error('Erro ao salvar histórico:', error);
        throw error;
    }
}

async function carregarHistoricoOneDrive(accessToken) {
    // Nome da pasta no formato: Nome_DD-MM-AAAA
    const pastaNome = `${dadosUsuario.nome}_${formatarData(dadosUsuario.dataInicio).replace(/\//g, '-')}`;
    
    try {
        // PASSO 1: Encontrar pasta
        const folderResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$filter=name eq '${pastaNome}' and folder ne null`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!folderResponse.ok) {
            throw new Error('Erro ao buscar pasta');
        }
        
        const folderData = await folderResponse.json();
        if (!folderData.value || folderData.value.length === 0) {
            return null; // Pasta não encontrada
        }
        
        pastaId = folderData.value[0].id;
        
        // PASSO 2: Carregar arquivo de histórico
        const historicoResponse = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/historico.json:/content`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        if (!historicoResponse.ok) {
            if (historicoResponse.status === 404) return null;
            throw new Error('Erro ao carregar histórico');
        }
        
        return await historicoResponse.json();
    } catch (error) {
        console.error('Erro ao carregar histórico:', error);
        return null;
    }
}

// =============== EVENTOS PRINCIPAIS ===============
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa botões de exportação
    document.getElementById('btnExportExcel').addEventListener('click', exportarParaExcel);
    document.getElementById('btnExportPDF').addEventListener('click', exportarParaPDF);
    
    // Verifica se há dados salvos localmente
    if (carregarDadosLocalStorage()) {
        // Já temos dados, mostra a tela de gastos diretamente
        document.getElementById('formIdentificacao').style.display = 'none';
        document.getElementById('areaFotos').style.display = 'block';
        
        // Configura campos com os dados salvos
        const dataRegistro = document.getElementById('dataRegistro');
        dataRegistro.min = dadosUsuario.dataInicio;
        dataRegistro.max = dadosUsuario.dataFim;
        dataRegistro.value = new Date().toISOString().split('T')[0];
        
        // Atualiza interface
        atualizarSaldoDisponivel(valorDisponivel);
        atualizarPreview();
        atualizarTotais();
    }
});

// Formulário de identificação
document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
    e.preventDefault();

    dadosUsuario = {
        nome: document.getElementById('nome').value.trim(),
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value
    };

    // Captura o valor disponível
    valorDisponivel = parseFloat(document.getElementById('valorDisponivel').value) || 0;

    // Configurar datas
    const dataRegistro = document.getElementById('dataRegistro');
    dataRegistro.min = dadosUsuario.dataInicio;
    dataRegistro.max = dadosUsuario.dataFim;
    dataRegistro.value = new Date().toISOString().split('T')[0];

    // Salva no localStorage para persistência
    salvarDadosLocalStorage();

    // Mostra a tela de gastos
    document.getElementById('formIdentificacao').style.display = 'none';
    document.getElementById('areaFotos').style.display = 'block';
    
    // Atualiza saldo
    atualizarSaldoDisponivel(valorDisponivel);
});

// Botão Voltar
document.getElementById('btnVoltar').addEventListener('click', function() {
    // Salva dados atuais
    salvarDadosLocalStorage();
    
    // Volta para a tela inicial
    document.getElementById('areaFotos').style.display = 'none';
    document.getElementById('formIdentificacao').style.display = 'block';
    
    // Preenche os campos com os valores atuais
    document.getElementById('nome').value = dadosUsuario.nome || '';
    document.getElementById('dataInicio').value = dadosUsuario.dataInicio || '';
    document.getElementById('dataFim').value = dadosUsuario.dataFim || '';
    document.getElementById('valorDisponivel').value = valorDisponivel || '';
});

// Adicionar foto
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
            salvarDadosLocalStorage(); // Salva após cada adição
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
            accessToken = e.data.access_token;

            try {
                // Salva histórico primeiro (cria pasta se necessário)
                await salvarHistoricoOneDrive(accessToken);
                
                // Upload dos arquivos para a pasta
                let uploadedCount = 0;
                for (const foto of fotos) {
                    // Só faz upload de fotos que tenham o arquivo disponível
                    if (foto.arquivo) {
                        const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${pastaId}:/${foto.nomeArquivo}:/content`, {
                            method: 'PUT',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: foto.arquivo
                        });

                        if (response.ok) {
                            uploadedCount++;
                        } else {
                            console.error(`Erro ao enviar ${foto.nomeArquivo}: ${response.status}`);
                        }
                    }
                }

                // Fecha a janela de autenticação e atualiza status
                authWindow.close();
                
                if (uploadedCount > 0) {
                    alert(`${uploadedCount} comprovantes salvos com sucesso!`);
                    // Não limpa as fotos, pois queremos manter o histórico
                } else {
                    alert('Dados salvos, mas não havia novos comprovantes para enviar.');
                }
                
                // Abre o OneDrive
                window.open('https://onedrive.live.com/', '_blank');
            } catch (error) {
                alert('Erro ao salvar: ' + error.message);
                console.error('Erro completo:', error);
                authWindow.close();
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
