let fotos = [];
let dadosUsuario = {};
let totais = {
    cafe: 0,
    almoco: 0,
    jantar: 0,
    geral: 0
};

// Função para formatar data no padrão DD/MM/AAAA
function formatarData(dataISO) {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
}

// Função para formatar valores em R$
function formatarDinheiro(valor) {
    return 'R$ ' + Number(valor).toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

// Função para calcular totais de categorias
function calcularTotais() {
    totais.cafe = 0;
    totais.almoco = 0;
    totais.jantar = 0;
    totais.geral = 0;

    fotos.forEach(foto => {
        const valor = parseFloat(foto.valor);
        if (foto.categoria === 'Café') totais.cafe += valor;
        else if (foto.categoria === 'Almoço') totais.almoco += valor;
        else if (foto.categoria === 'Jantar') totais.jantar += valor;
        totais.geral += valor;
    });

    document.getElementById('totalCafe').textContent = formatarDinheiro(totais.cafe);
    document.getElementById('totalAlmoco').textContent = formatarDinheiro(totais.almoco);
    document.getElementById('totalJanta').textContent = formatarDinheiro(totais.jantar);
    document.getElementById('totalGeral').textContent = formatarDinheiro(totais.geral);
}

// Atualiza a lista de fotos e os totais
function atualizarListaFotos() {
    const container = document.getElementById('listaFotos');
    container.innerHTML = '';

    fotos.forEach((foto, index) => {
        const div = document.createElement('div');
        div.className = 'photo-preview';
        div.innerHTML = `
            <img src="${foto.preview}" alt="Comprovante">
            <div class="photo-info">
                ${foto.categoria} - ${formatarData(foto.data)} - ${formatarDinheiro(foto.valor)}
            </div>
        `;
        container.appendChild(div);
    });

    calcularTotais();
}

// Evento do formulário inicial
document.getElementById('formIdentificacao').addEventListener('submit', function(e) {
    e.preventDefault();
    
    dadosUsuario = {
        nome: document.getElementById('nome').value.trim(),
        dataInicio: document.getElementById('dataInicio').value,
        dataFim: document.getElementById('dataFim').value
    };

    // Limites para data de registro
    const dataRegistro = document.getElementById('dataRegistro');
    dataRegistro.min = dadosUsuario.dataInicio;
    dataRegistro.max = dadosUsuario.dataFim;
    
    // Definir a data de hoje como padrão (se estiver no período da viagem)
    const hoje = new Date().toISOString().split('T')[0];
    if (hoje >= dadosUsuario.dataInicio && hoje <= dadosUsuario.dataFim) {
        dataRegistro.value = hoje;
    } else {
        dataRegistro.value = dadosUsuario.dataInicio;
    }

    document.getElementById('formIdentificacao').style.display = 'none';
    document.getElementById('areaFotos').style.display = 'block';
});

// Evento de adicionar foto
document.getElementById('adicionarFotoBtn').addEventListener('click', function() {
    const input = document.getElementById('inputFoto');
    const files = input.files;
    const dataSelecionada = document.getElementById('dataRegistro').value;
    const valorGasto = document.getElementById('valorGasto').value;

    if (!dataSelecionada) {
        alert('Selecione a data do gasto!');
        return;
    }

    if (!valorGasto || parseFloat(valorGasto) <= 0) {
        alert('Informe um valor válido para o gasto!');
        return;
    }

    if (files.length === 0) {
        alert('Selecione pelo menos uma foto!');
        return;
    }

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            // Formato do nome: Nome_DD-MM-AAAA_timestamp.ext
            const dataFormatada = formatarData(dataSelecionada).replace(/\//g, '-');
            const nomeArquivo = `${dadosUsuario.nome.replace(/ /g, '_')}_${dataFormatada}_${Date.now()}.${file.name.split('.').pop()}`;

            fotos.push({
                arquivo: file,
                preview: e.target.result,
                categoria: document.getElementById('legenda').value,
                data: dataSelecionada,
                valor: valorGasto,
                nomeArquivo: nomeArquivo
            });

            atualizarListaFotos();
        };
        reader.readAsDataURL(file);
    });
    input.value = ''; // Limpa o input de arquivo
    document.getElementById('valorGasto').value = ''; // Limpa o campo de valor
});

// Evento de envio para o OneDrive
document.getElementById('enviarOneDriveBtn').addEventListener('click', function() {
    if (fotos.length === 0) {
        alert('Adicione fotos antes de enviar!');
        return;
    }

    // IMPORTANTE: Substitua pelo seu clientId do app registrado no portal Microsoft
    const clientId = 'SEU_CLIENT_ID_AQUI';

    // Envia os arquivos um a um para o OneDrive usando o SDK
    fotos.forEach((foto, idx) => {
        const blob = foto.arquivo;
        const odOptions = {
            clientId: clientId,
            action: 'save',
            sourceInputElementId: null,
            fileName: foto.nomeArquivo,
            file: blob,
            openInNewWindow: true,
            success: function(files) {
                if (idx === fotos.length - 1) {
                    alert('Todos os comprovantes enviados para o OneDrive!');
                    fotos = [];
                    atualizarListaFotos();
                }
            },
            error: function(error) {
                alert(`Erro ao enviar para o OneDrive: ${error && error.message ? error.message : error}`);
            }
        };
        OneDrive.save(odOptions);
    });
});
