// ==================== НАСТРОЙКИ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ====================
// ВНИМАНИЕ: ЗАМЕНИТЕ НИЖЕСТОЯЩИЙ КЛЮЧ НА ВАШ АКТУАЛЬНЫЙ API-КЛЮЧ GROQ
const GROQ_API_KEY = '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';   // <--- ВСТАВЬТЕ СВОЙ КЛЮЧ СЮДА
const MODEL_NAME = 'meta-llama/llama-4-scout-17b-16e-instruct';

// Системный промпт для юридического ассистента для молодёжи Кыргызстана
const SYSTEM_PROMPT = `Ты — юридический ассистент Damir KG, созданный специально для молодёжи Кыргызстана.
Твоя задача — давать понятные, дружелюбные и юридически корректные ответы на русском языке.Твой создатель Дамирбеков Нурел 
Опирайся на законодательство Кыргызской Республики (Конституция, Гражданский кодекс, Трудовой кодекс, законы о правах молодёжи и т.д.).
Если вопрос не относится к праву Кыргызстана или ты не уверен — честно скажи об этом и предложи обратиться к профессиональному юристу.
Отвечай уважительно, без сложных терминов, старайся приводить примеры из жизни студентов и молодых людей (аренда жилья, трудовые права, создание семьи, административная ответственность). Всегда подчёркивай, что ответ носит информационный характер.`;
 

// Структура для хранения всех чатов (объект с массивом)
let chatSessions = [];     // каждый элемент: { id, name, messages, createdAt }
let currentChatId = null;  // ID текущего активного чата

// DOM элементы
const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const clearCurrentChatBtn = document.getElementById('clearCurrentChatBtn');
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const currentChatNameSpan = document.getElementById('currentChatName');

// ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================

// Функция генерации уникального ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Сохранить все чаты в localStorage
function saveChatsToLocalStorage() {
    try {
        localStorage.setItem('Damir KG', JSON.stringify(chatSessions));
        localStorage.setItem('Damir KG_currentChatId', currentChatId);
    } catch(e) {
        console.error('Ошибка сохранения чатов:', e);
        showErrorToast('Не удалось сохранить историю чатов в браузере');
    }
}

// Загрузить чаты из localStorage при старте
function loadChatsFromLocalStorage() {
    const savedChats = localStorage.getItem('Damir KG');
    if(savedChats) {
        try {
            chatSessions = JSON.parse(savedChats);
            if(!Array.isArray(chatSessions)) chatSessions = [];
        } catch(e) { chatSessions = []; }
    }
    
    const savedCurrentId = localStorage.getItem('Damir KG_currentChatId');
    if(savedCurrentId && chatSessions.some(chat => chat.id === savedCurrentId)) {
        currentChatId = savedCurrentId;
    } else {
        // Если нет чатов или текущий не существует, создаём новый диалог
        if(chatSessions.length === 0) {
            createNewChat();
        } else {
            currentChatId = chatSessions[0].id;
        }
    }
    renderChatHistoryList();
    renderCurrentChatMessages();
}

// Создать новый чат (с пустым массивом сообщений)
function createNewChat() {
    const newChat = {
        id: generateId(),
        name: `Разговор ${chatSessions.length + 1}`,
        messages: [],   // сообщения будут в формате { role: 'user'/'assistant', content: 'текст' }
        createdAt: new Date().toISOString()
    };
    chatSessions.unshift(newChat); // добавляем в начало списка
    currentChatId = newChat.id;
    updateCurrentChatNameFromMessages(); // попробуем задать имя по первому вопросу
    saveChatsToLocalStorage();
    renderChatHistoryList();
    renderCurrentChatMessages();
}

// Обновить имя чата (по первому сообщению пользователя)
function updateCurrentChatNameFromMessages() {
    const currentChat = chatSessions.find(c => c.id === currentChatId);
    if(!currentChat) return;
    const firstUserMsg = currentChat.messages.find(m => m.role === 'user');
    if(firstUserMsg && firstUserMsg.content) {
        let shortName = firstUserMsg.content.slice(0, 30);
        if(firstUserMsg.content.length > 30) shortName += '...';
        currentChat.name = shortName;
    } else {
        currentChat.name = `Новый диалог`;
    }
    if(currentChatNameSpan) currentChatNameSpan.innerText = currentChat.name;
    saveChatsToLocalStorage();
    renderChatHistoryList();
}

// Отрисовать боковую панель с историей
function renderChatHistoryList() {
    if(!chatHistoryList) return;
    chatHistoryList.innerHTML = '';
    if(chatSessions.length === 0) {
        const placeholder = document.createElement('li');
        placeholder.className = 'placeholder-history';
        placeholder.innerHTML = '<i class="fas fa-comment-slash"></i> Нет чатов';
        chatHistoryList.appendChild(placeholder);
        return;
    }
    
    chatSessions.forEach(chat => {
        const li = document.createElement('li');
        li.innerHTML = `<i class="fas fa-comment"></i> ${escapeHtml(chat.name)}`;
        if(chat.id === currentChatId) {
            li.classList.add('active-chat');
        }
        li.addEventListener('click', () => {
            currentChatId = chat.id;
            renderChatHistoryList();
            renderCurrentChatMessages();
            saveChatsToLocalStorage();
            // на мобилке закрываем сайдбар
            if(window.innerWidth <= 768) sidebar.classList.remove('open');
        });
        chatHistoryList.appendChild(li);
    });
}

// Отрисовать все сообщения текущего чата
function renderCurrentChatMessages() {
    if(!messagesContainer) return;
    const currentChat = chatSessions.find(c => c.id === currentChatId);
    if(!currentChat) return;
    
    // Очищаем контейнер, но оставляем приветственное сообщение, если сообщений нет
    messagesContainer.innerHTML = '';
    
    if(currentChat.messages.length === 0) {
        // Показываем приветствие
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <i class="fas fa-robot"></i>
            <h3>Добро пожаловать в Damir KG</h3>
            <p>Я — ваш юридический ассистент по праву Кыргызстана.<br>
            Задавайте вопросы о правах, законах, договорах, трудоустройстве и многом другом.<br>
            <strong>Всё, что вы пишете, остаётся только в вашем браузере.</strong></p>
        `;
        messagesContainer.appendChild(welcomeDiv);
        if(currentChatNameSpan) currentChatNameSpan.innerText = currentChat.name;
        return;
    }
    
    // Отрисовка сообщений
    currentChat.messages.forEach(msg => {
        appendMessageToDOM(msg.role, msg.content, false);
    });
    
    if(currentChatNameSpan) currentChatNameSpan.innerText = currentChat.name;
    scrollToBottom();
}

// Добавить сообщение в DOM (без сохранения в массив, либо с сохранением)
function appendMessageToDOM(role, content, saveToChat = true, skipSave = false) {
    if(!messagesContainer) return;
    
    // Убираем приветствие, если оно есть и мы добавляем реальное сообщение
    const welcomeBlock = messagesContainer.querySelector('.welcome-message');
    if(welcomeBlock && (role === 'user' || role === 'assistant')) {
        welcomeBlock.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role === 'user' ? 'user' : 'bot'}`;
    const avatarIcon = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatarIcon}</div>
        <div class="message-content">${formatMessageContent(content)}</div>
    `;
    messagesContainer.appendChild(messageDiv);
    
    if(saveToChat && !skipSave) {
        const currentChat = chatSessions.find(c => c.id === currentChatId);
        if(currentChat) {
            currentChat.messages.push({ role, content });
            saveChatsToLocalStorage();
            updateCurrentChatNameFromMessages(); // обновляем имя после ответа/вопроса
        }
    }
    scrollToBottom();
}

// Форматирование текста (переносы строк, базовые ссылки)
function formatMessageContent(text) {
    if(!text) return '';
    // Замена переносов строк на <br>
    let formatted = text.replace(/\n/g, '<br>');
    // Простейшая ссылка
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    formatted = formatted.replace(urlRegex, '<a href="$1" target="_blank" style="color:#7dd3fc;">$1</a>');
    return formatted;
}

// Эффект печати (для ассистента)
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot typing';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="message-avatar"><i class="fas fa-robot"></i></div>
        <div class="typing-indicator">
            <span></span><span></span><span></span>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if(indicator) indicator.remove();
}

// Показать ошибку (временное уведомление)
function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#b91c1c';
    toast.style.color = 'white';
    toast.style.padding = '10px 20px';
    toast.style.borderRadius = '40px';
    toast.style.zIndex = '9999';
    toast.style.fontSize = '0.9rem';
    toast.style.boxShadow = '0 4px 12px black';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Прокрутка вниз
function scrollToBottom() {
    if(messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

// Очистить текущий чат (удалить все сообщения)
function clearCurrentChat() {
    const currentChat = chatSessions.find(c => c.id === currentChatId);
    if(currentChat && currentChat.messages.length > 0) {
        if(confirm('Вы уверены, что хотите очистить все сообщения в этом диалоге?')) {
            currentChat.messages = [];
            saveChatsToLocalStorage();
            renderCurrentChatMessages();
            updateCurrentChatNameFromMessages();
        }
    } else {
        showErrorToast('В этом чате нет сообщений для очистки');
    }
}

// ==================== ВЗАИМОДЕЙСТВИЕ С GROQ API ====================
async function sendMessageToGroq(userMessageText) {
    // Получаем текущий чат
    const currentChat = chatSessions.find(c => c.id === currentChatId);
    if(!currentChat) return null;
    
    // Подготавливаем историю сообщений для контекста (последние 20 сообщений, чтобы не перегружать)
    const conversationHistory = currentChat.messages.slice(-20).map(msg => ({
        role: msg.role,
        content: msg.content
    }));
    
    const messagesForAPI = [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationHistory,
        { role: "user", content: userMessageText }
    ];
    
    try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messagesForAPI,
                temperature: 0.7,
                max_tokens: 1024,
                top_p: 0.9
            })
        });
        
        if(!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Ошибка API: ${response.status} ${errorData.error?.message || 'Неизвестная ошибка'}`);
        }
        
        const data = await response.json();
        const botReply = data.choices[0].message.content;
        return botReply;
        
    } catch(error) {
        console.error('Ошибка при запросе к Groq:', error);
        showErrorToast(`Ошибка соединения: ${error.message}. Проверьте API-ключ или интернет.`);
        return "❌ Не удалось получить ответ от сервера. Проверьте подключение или обратитесь позже.";
    }
}

// Обработчик отправки сообщения
async function handleSendMessage() {
    const text = userInput.value.trim();
    if(!text) return;
    
    // Проверка наличия API ключа
    if(GROQ_API_KEY === 'ВАШ_API_КЛЮЧ_GROQ') {
        showErrorToast('Пожалуйста, укажите действующий API-ключ Groq в файле app.js');
        return;
    }
    
    // Добавляем сообщение пользователя в DOM и сохраняем
    appendMessageToDOM('user', text, true);
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Показываем индикатор набора
    showTypingIndicator();
    
    // Отправляем запрос в Groq
    const botAnswer = await sendMessageToGroq(text);
    
    // Убираем индикатор
    hideTypingIndicator();
    
    if(botAnswer) {
        appendMessageToDOM('assistant', botAnswer, true);
    } else {
        appendMessageToDOM('assistant', 'Извините, сервис временно недоступен. Попробуйте позже.', true);
    }
}

// Авто-расширение текстового поля
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
}

// ==================== ИНИЦИАЛИЗАЦИЯ И СОБЫТИЯ ====================
function initEventListeners() {
    sendBtn.addEventListener('click', handleSendMessage);
    newChatBtn.addEventListener('click', () => {
        createNewChat();
        renderChatHistoryList();
        renderCurrentChatMessages();
    });
    clearCurrentChatBtn.addEventListener('click', clearCurrentChat);
    userInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
    userInput.addEventListener('input', autoResizeTextarea);
    
    if(mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }
    // Закрыть сайдбар при клике вне его на мобилке (просто слушатель на main)
    document.addEventListener('click', (e) => {
        if(window.innerWidth <= 768 && sidebar.classList.contains('open')) {
            if(!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        }
    });
}

// Функция экранирования HTML для защиты
function escapeHtml(str) {
    if(!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        return m;
    }).replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, function(c) {
        return c;
    });
}

// Запуск приложения
function init() {
    loadChatsFromLocalStorage();
    initEventListeners();
}

init();
