const express = require('express');
const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('exceljs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const prisma = new PrismaClient();
const port = 3000;
require('dotenv').config();

// Dados do admin
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin';



// Middleware para processar JSON nas requisições e para servir arquivos estáticos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuração da sessão
app.use(session({
    secret: 'secret_key', // Substitua por uma chave segura em produção
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Coloque `true` em produção com HTTPS
}));

// Middleware para verificar se o usuário está autenticado
function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    } else {
        res.status(401).send('Por favor, faça login para acessar esta página.');
    }
}

// Rota para verificar se o usuário está autenticado
app.get('/check-auth', (req, res) => {
    if (req.session.userId) {
        res.json({ isAuthenticated: true, isAdmin: req.session.username === ADMIN_USERNAME });
    } else {
        res.json({ isAuthenticated: false });
    }
});

// Middleware para verificar se o usuário é admin
function isAdmin(req, res, next) {
    if (req.session.username === ADMIN_USERNAME) {
        return next();
    } else {
        res.status(403).json({ error: 'Apenas o admin pode encerrar chamados.' });
    }
}

// Rota de registro de usuário
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                username,
                password: hashedPassword
            }
        });
        res.json({ message: 'Usuário registrado com sucesso' });
    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ error: 'Erro ao registrar usuário' });
    }
});

// Rota de login
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Autenticação do admin
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        req.session.userId = 'admin';
        req.session.username = ADMIN_USERNAME;
        return res.json({ message: 'Login de admin bem-sucedido' });
    }

    // Autenticação de usuários comuns
    try {
        const user = await prisma.user.findUnique({
            where: { username }
        });

        if (user && await bcrypt.compare(password, user.password)) {
            req.session.userId = user.id;
            req.session.username = username;
            res.json({ message: 'Login bem-sucedido' });
        } else {
            res.status(401).json({ error: 'Credenciais inválidas' });
        }
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});


// Rota de logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Erro ao fazer logout' });
        }
        res.json({ message: 'Logout bem-sucedido' });
    });
});

// Rota para encerrar o chamado (somente admin)
app.put('/update-ticket-status/:id', isAuthenticated, isAdmin, async (req, res) => {
    const ticketId = parseInt(req.params.id);

    try {
        const updateData = { status: 'Encerrado', closedAt: new Date() };

        const updatedTicket = await prisma.ticket.update({
            where: { id: ticketId },
            data: updateData
        });

        res.json(updatedTicket);
    } catch (error) {
        console.error('Erro ao encerrar o chamado:', error);
        res.status(500).json({ error: 'Erro ao encerrar o chamado' });
    }
});

// Rota para fazer o download do relatório de chamados (protegida)
app.get('/download-report', isAuthenticated, async (req, res) => {
    try {
        const tickets = await prisma.ticket.findMany();

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Relatório de Chamados');

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

        tickets.forEach(ticket => worksheet.addRow(ticket));

        res.setHeader('Content-Disposition', 'attachment; filename="relatorio_chamados.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erro ao gerar o relatório:', error);
        res.status(500).send('Erro ao gerar o relatório');
    }
});

// Rota para abrir um novo chamado (protegida)
app.post('/add-ticket', isAuthenticated, async (req, res) => {
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

// Rota para atualizar o status de um chamado e registrar o horário de encerramento (protegida)
app.put('/update-ticket-status/:id', isAuthenticated, async (req, res) => {
    const ticketId = parseInt(req.params.id);
    const { status } = req.body;

    try {
        const updateData = { status };

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

// Rota para listar chamados organizados por prioridade (protegida)
app.get('/tickets-by-priority', isAuthenticated, async (req, res) => {
    try {
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

// Função para definir a classe CSS de prioridade
function getPriorityClass(priority) {
    switch (priority) {
        case 'Muito Baixa':
            return 'priority-muito-baixa';
        case 'Baixa':
            return 'priority-baixa';
        case 'Média':
            return 'priority-media';
        case 'Alta':
            return 'priority-alta';
        case 'Muito Alta':
            return 'priority-muito-alta';
        default:
            return '';
    }
}

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
