const express = require('express');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs'); // Importa a biblioteca exceljs
const app = express();
const prisma = new PrismaClient();
const port = 3000;
require('dotenv').config();

// Middleware para processar JSON nas requisições
app.use(express.json());

// Servir arquivos estáticos da pasta "public"
app.use(express.static('public'));

// Rota para fazer o download do relatório de chamados em formato de planilha
app.get('/download-report', async (req, res) => {
    try {
        const tickets = await prisma.ticket.findMany();

        // Cria uma nova planilha
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relatório de Chamados');

        // Adiciona o cabeçalho
        worksheet.columns = [
            { header: 'ID', key: 'id', width: 10 },
            { header: 'Nome do Solicitante', key: 'requester', width: 30 },
            { header: 'Departamento', key: 'department', width: 20 },
            { header: 'Descrição', key: 'description', width: 30 },
            { header: 'Prioridade', key: 'priority', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Data de Abertura', key: 'createdAt', width: 20 },
            { header: 'Data de Encerramento', key: 'closedAt', width: 20 }
        ];

        // Adiciona os dados dos chamados
        tickets.forEach(ticket => worksheet.addRow(ticket));

        // Define o cabeçalho para download
        res.setHeader('Content-Disposition', 'attachment; filename="relatorio_chamados.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Envia o arquivo para o cliente
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao gerar o relatório:', error);
        res.status(500).send('Erro ao gerar o relatório');
    }
});

// Função para definir a classe CSS de prioridade
function getPriorityClass(priority) {
    switch (priority) {
        case 'Muito Baixa':
        case 'Baixa':
            return 'priority-baixa';
        case 'Média':
            return 'priority-media';
        case 'Alta':
        case 'Muito Alta':
            return 'priority-alta';
        default:
            return '';
    }
}

// Rota para abrir um novo chamado
app.post('/add-ticket', async (req, res) => {
    const { requester, department, description, priority } = req.body;

    try {
        const newTicket = await prisma.ticket.create({
            data: { requester, department, description, priority, status: 'Aberto' },
        });
        res.json({ message: 'Chamado aberto com sucesso', newTicket });
    } catch (error) {
        console.error('Erro ao abrir o chamado:', error);
        res.status(500).json({ error: 'Erro ao abrir o chamado', details: error });
    }
});

// Rota para atualizar o status de um chamado e registrar o horário de encerramento
app.put('/update-ticket-status/:id', async (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { status } = req.body;

    try {
        const updateData = { status };

        // Define o horário de encerramento se o status for "Encerrado"
        if (status === 'Encerrado') {
            updateData.closedAt = new Date();
        }

        const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData
        });

        res.json(updatedTicket);
    } catch (error) {
        console.error('Erro ao atualizar o status do chamado:', error);
        res.status(500).json({ error: 'Erro ao atualizar o status do chamado' });
    }
});

// Rota para listar chamados organizados por prioridade com classes de cor
app.get('/tickets-by-priority', async (req, res) => {
    try {
        // Busca chamados que não estão encerrados
        const tickets = await prisma.ticket.findMany({
            where: { status: { not: 'Encerrado' } }
        });
        
        const ticketsByPriority = tickets.reduce((acc, ticket) => {
            const priorityClass = getPriorityClass(ticket.priority);
            const ticketWithClass = { ...ticket, priorityClass };
            const priority = ticket.priority;

            if (!acc[priority]) acc[priority] = [];
            acc[priority].push(ticketWithClass);
            return acc;
        }, {});

        res.json(ticketsByPriority);
    } catch (error) {
        console.error('Erro ao buscar chamados por prioridade:', error);
        res.status(500).json({ error: 'Erro ao buscar chamados por prioridade' });
    }
});

// Rota para atualizar o status de um chamado e registrar o horário de encerramento
app.put('/update-ticket-status/:id', async (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { status } = req.body;

    try {
        const updateData = { status };

        // Define o horário de encerramento se o status for "Encerrado"
        if (status === 'Encerrado') {
            updateData.closedAt = new Date();
        }

        const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData
        });

        res.json(updatedTicket);
    } catch (error) {
        console.error('Erro ao atualizar o status do chamado:', error);
        res.status(500).json({ error: 'Erro ao atualizar o status do chamado' });
    }
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
