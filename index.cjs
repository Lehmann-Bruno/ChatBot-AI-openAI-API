// CONFIG
require("dotenv").config();
const { petshopTools } = require("./tools.js");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const OpenAI = require("openai");
const fs = require("fs");

const BUSINESS_NAME = process.env.BUSINESS_NAME || "PetUp";
const userMeta = {}; // nome do cliente
const lastMessageTime = {}; // tempo desde a ultima mensagem
let lastReportRequest = {}; // guarda o último pet consultado para cada usuário

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { headless: true },
});

const FILE = "./memory.json";
let chatHistory = fs.existsSync(FILE)
  ? JSON.parse(fs.readFileSync(FILE))
  : {};

const PENDING_FILE = "./pending_requests.json";
let pendingRequests = fs.existsSync(PENDING_FILE)
  ? JSON.parse(fs.readFileSync(PENDING_FILE))
  : [];

const PET_FILE = "./pets.json";
let petDB = fs.existsSync(PET_FILE)
  ? JSON.parse(fs.readFileSync(PET_FILE))
  : {};

// FIM DA CONFIG

// FUNÇÕES
function saveMemory() { // salva o contexto da conversa
  for (const user in chatHistory) {
    if (chatHistory[user].length > 10) {
      chatHistory[user] = chatHistory[user].slice(-10); // limita a memória para 10 mensagens
    }
  }
  fs.writeFileSync(FILE, JSON.stringify(chatHistory, null, 2));
}

function addPendingRequest(user, text, intent, subject = "seu pedido") { // placeholder, eventualmente manda request direto pro site
  const entry = {
    user,
    intent,
    text,
    timestamp: new Date().toISOString(),
  };
  pendingRequests.push(entry);
  fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingRequests, null, 2));

  const friendlyReplies = [
    `Certo! Já deixei ${subject} com a equipe da ${BUSINESS_NAME}. Eles vão te avisar assim que possível. 🐾`,
    `Anotei ${subject}. A equipe da ${BUSINESS_NAME} vai cuidar disso e te dar um retorno em breve. 💕`,
    `Entendi ${subject}. Nossa equipe da ${BUSINESS_NAME} vai te ajudar com isso rapidinho! 🐶`
  ];

  return friendlyReplies[Math.floor(Math.random() * friendlyReplies.length)];
}

function savePetDB() { // sava os animais novos em pets.json
  fs.writeFileSync(PET_FILE, JSON.stringify(petDB, null, 2));
}

function addPet(userId, petName, species, breed) { // cria um objeto pet novo
  if (!petDB[userId]) petDB[userId] = [];
  petDB[userId].push({ petName, species, breed });
  savePetDB();
}

function getPets(userId) { // lista todos os pets
  return petDB[userId] || [];
}

// FIM DAS FUNÇÕES

// primeiro login precisa de conexão com o qr code
client.on("qr", (qr) => {
  console.log("📱 Scan this QR code to log in:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log(`${BUSINESS_NAME} Bot is ready!`);
});

client.on("message", async (message) => {
  try {
    if (message.fromMe) return; // eventualmente adicionar timeout de alguns minutos, que impede o bot de ativar se um funcionario estiver falando com o cliente.
    const user = message.from;
    const chat = await message.getChat();
    const text = message.body.trim();
    const now = Date.now();

    // ===== TIME CONTROL =====
    const lastTime = lastMessageTime[user];
    const timeDiff = lastTime ? (now - lastTime) / 1000 / 60 : 0; // em minutos

    // Apaga o contexto caso o usuário fique inativo por 20 minutos
    if (lastTime && timeDiff > 20) {
      chatHistory[user] = [
        {
          role: "system",
          content: `Você é o assistente virtual da ${BUSINESS_NAME}.
          O tutor se chama ${contactName}.
          Você ajuda tutores de pets com informações, agendamentos e suporte.
          Pode responder sobre banho e tosa, hospedagem, transporte, vacinação, consultas e cuidar de cadastros e reclamações.
          Use linguagem breve, simpática e profissional.

          IMPORTANTE:
          - Sempre que o tutor mencionar "relatório", "relatorio do pet", "relatorio geral", "me envie o relatório" ou "relatório de [nome do pet]",
            chame a função "send_pet_report" passando o nome do pet mencionado.
          - Se o tutor não especificar o tipo ou serviço, envie o último relatório disponível do pet.
          - Nunca explique como o sistema funciona nem mencione arquivos internos.
          - Se o tutor perguntar "como funcionam os relatórios", responda apenas de forma prática:
            "Os relatórios são enviados sempre que há uma atualização do seu pet ou quando você pedir. Deseja que eu envie o último agora?"
          - Nunca diga o que você faz internamente ou por que faz algo.
          REGRAS DE SEGURANÇA (OBRIGATÓRIAS):
          - Nunca sugerir alimentos, dietas, receitas caseiras, suplementos, remédios, medicações, produtos de uso veterinário ou quaisquer cuidados de saúde específicos.
          - Caso o tutor pergunte sobre alimentação, dieta, saúde, sintomas, doenças, medicamentos, toxicidade ou “o que posso dar”, responda sempre:
            "Para segurança do seu pet, não posso recomendar alimentos ou cuidados médicos. O ideal é consultar um médico-veterinário. Posso ajudar com serviços da petshop."
          - Não sugerir nenhum tipo de comida humana, mesmo que pareça inofensivo.
          - Se a IA não tiver certeza ou a pergunta envolver saúde — sempre recusar educadamente e redirecionar.`,
        },
      ];

      await message.reply(
        `Olá novamente! 😊 Faz um tempinho desde nossa última conversa. Como posso te ajudar hoje?`
      );
    }
    // Delay basico pra IA parecer que está pensando
    else if (lastTime && timeDiff > 5 && timeDiff <= 20) {
      console.log(`[Delay] ${user} - waiting 2s before responding...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    lastMessageTime[user] = now;

    const offTopicWords = [ // palavras chaves para a IA não sair do tópico
      "receita",
      "filme",
      "política",
      "piada",
      "dinheiro",
      "história",
      "programar",
      "cozinhar",
      "chatgpt",
      "hack",
      "porn",
      "religião",
    ];
    if (offTopicWords.some((w) => text.toLowerCase().includes(w))) {
      await message.reply(
        `Posso te ajudar apenas com assuntos sobre pets e serviços da ${BUSINESS_NAME}. 🐶`
      );
      return;
    }

    const contact = await message.getContact();
    const name = contact.pushname || contact.number || user;
    console.log(`[${name}] ${text}`);
    userMeta[user] = name;

    if (!petDB[user]) {
      petDB[user] = [];
      savePetDB();
    }

    if (!chatHistory[user]) {
      chatHistory[user] = [
        {
          role: "system",
          content: `Você é o assistente virtual da ${BUSINESS_NAME}. 
          Você ajuda tutores de pets com informações, agendamentos e suporte. 
          Pode responder sobre banho e tosa, hospedagem, transporte, vacinação, consultas e cuidar de cadastros e reclamações.
          Use linguagem breve, simpática e profissional, sem travessões ou emojis em excesso.`,
        },
      ];
      saveMemory();
    }

    chatHistory[user].push({ role: "user", content: text });

    const contactName = userMeta[user]?.customName || contact.pushname || contact.number || user;

    const systemPrompt = {
      role: "system",
      content: `Você é o assistente virtual da ${BUSINESS_NAME}.
    O tutor se chama ${contactName}.
    Você ajuda tutores de pets com informações, agendamentos e suporte.
    Pode responder sobre banho e tosa, hospedagem, transporte, vacinação, consultas e cuidar de cadastros e reclamações.
    Use linguagem breve, simpática e profissional.

    IMPORTANTE:
    - Sempre que o tutor mencionar "relatório", "relatorio do pet", "relatorio geral", "me envie o relatório" ou "relatório de [nome do pet]",
      chame a função "send_pet_report" passando o nome do pet mencionado.
    - Se o tutor não especificar o tipo ou serviço, envie o último relatório disponível do pet.
    - Nunca explique como o sistema funciona nem mencione arquivos internos.
    - Se o tutor perguntar "como funcionam os relatórios", responda apenas de forma prática:
      "Os relatórios são enviados sempre que há uma atualização do seu pet ou quando você pedir. Deseja que eu envie o último agora?"
    - Nunca diga o que você faz internamente ou por que faz algo.
      REGRAS DE SEGURANÇA (OBRIGATÓRIAS):
    - Nunca sugerir alimentos, dietas, receitas caseiras, suplementos, remédios, medicações, produtos de uso veterinário ou quaisquer cuidados de saúde específicos.
    - Caso o tutor pergunte sobre alimentação, dieta, saúde, sintomas, doenças, medicamentos, toxicidade ou “o que posso dar”, responda sempre:
      "Para segurança do seu pet, não posso recomendar alimentos ou cuidados médicos. O ideal é consultar um médico-veterinário. Posso ajudar com serviços da petshop."
    - Não sugerir nenhum tipo de comida humana, mesmo que pareça inofensivo.
    - Se a IA não tiver certeza ou a pergunta envolver saúde — sempre recusar educadamente e redirecionar.`,
    };

    const context = [
      systemPrompt,
      ...chatHistory[user].slice(-8).map((entry) => ({
        role:
          entry.role === "assistant" || entry.role === "system"
            ? entry.role
            : "user",
        content: entry.content,
      })),
    ];

    chat.sendStateTyping();
    let response = await openai.responses.create({
      model: "gpt-5-nano-2025-08-07",
      input: context,
      max_output_tokens: 1250,
      reasoning: { effort: "low" },
      tools: petshopTools,
      });

    if (response.output && response.output.length > 0) {
      const funcCall = response.output.find(
        (item) => item.type === "function_call" && item.status === "completed"
      );

      // ======== FUNÇÃO CHAMADA ========
      if (funcCall) {
        const fn = funcCall.name;
        const args = funcCall.arguments ? JSON.parse(funcCall.arguments || "{}") : {};
        let actionText = "";

        if (fn === "add_pet") {
          const pendingName = `${args.petName} (pendente)`;
          addPet(user, pendingName, args.species, args.breed || "");
          addPendingRequest(user, text, `Validação de cadastro de pet`, "seu pedido sobre cadastro de pet");

          actionText = `Adicionei o pet *${args.petName}* (${args.species}${args.breed ? ` - ${args.breed}` : ""}) como pendente no sistema. 🐾\n\n` +
                      `Um atendente da ${BUSINESS_NAME} vai validar as informações antes de confirmar o cadastro.`;
        }

        else if (fn === "delete_pet") {
          addPendingRequest(user, text, `Validação de remoção de pet`, "seu pedido sobre cadastro de pet");
          actionText = `Entendi o pedido de remoção do pet *${args.petName}*.\n` +
                      `Vou transferir para um atendente da ${BUSINESS_NAME} validar antes de prosseguir. 🐾` +
                      `${args.reason ? `\nMotivo informado: ${args.reason}` : ""}`;
        }

        else if (fn === "schedule_consultation") {
          addPendingRequest(user, text, `Solicitação de agendamento de consulta (${args.consultationType})`, "seu pedido sobre cadastro de pet");
          actionText = `Perfeito! Vou transferir o pedido de agendamento de *${args.consultationType}* ` +
                      `para um atendente da ${BUSINESS_NAME} validar e confirmar o horário.\n\n` +
                      `Pet: ${args.petName}${args.preferredTime ? ` | Preferência: ${args.preferredTime}` : ""}`;
        }

        else if (fn === "list_pets") {
          const userPets = getPets(user);
          const templatePets = [
            { petName: "Thor", species: "Cachorro", breed: "Labrador Retriever" },
            { petName: "Mia", species: "Gato", breed: "SRD" },
          ];
          const allPets = [...templatePets, ...userPets];

          if (allPets.length === 0) {
            actionText = "Você ainda não tem pets cadastrados. Deseja adicionar um? 🐕🐈";
          } else {
            actionText =
              "Aqui estão seus pets:\n" +
              allPets
                .map(
                  (p) =>
                    `• ${p.petName} (${p.species}${p.breed ? ` - ${p.breed}` : ""})`
                )
                .join("\n");
          }
        }

        else if (fn === "send_pet_report") {
          const petName = args.petName?.trim() || "";
          const filePath = `./relatorios/${petName}.pdf`;

          if (fs.existsSync(filePath)) {
            const { MessageMedia } = require("whatsapp-web.js");
            const media = MessageMedia.fromFilePath(filePath);
            await client.sendMessage(user, media);
            actionText = `Segue o relatório mais recente de *${petName}* 🐾`;
          } else {
            actionText = `Ainda não há PDF disponível para o pet *${petName}*. Assim que o relatório for gerado, aviso por aqui. 🐾`;
          }
        }

        else if (fn === "report_issue") {
          actionText = `Posso registrar sua mensagem como ocorrência: "${args.description}". Deseja prosseguir? 💬`;
        }

        else {
          const unknownName = fn || "função não identificada";
          addPendingRequest(user, text, `Solicitação de função desconhecida (${unknownName})`, "seu pedido sobre cadastro de pet");
          actionText = `Entendi que você quer ${fn}, mas ainda não consigo fazer isso automaticamente. Registrei sua solicitação para a equipe da ${BUSINESS_NAME}. 🐾`;
        }

        // Envia a resposta e encerra a função imediatamente
        await message.reply(actionText);
        chatHistory[user].push({ role: "assistant", content: actionText });
        saveMemory();
        return;
      }
    }

    const aiOutput = response.output_text?.trim() || null;

    if (
      ["sim", "pode enviar", "envia", "manda", "ok", "quero sim"].some((kw) =>
        text.toLowerCase().includes(kw)
      ) &&
      lastReportRequest[user]
    ) {
      const petName = lastReportRequest[user];
      const reports = reportDB[petName];

      if (reports && reports.length > 0) {
        const last = reports[reports.length - 1];
        const fullReport = `${last.message}\n\n(Serviço: ${last.service}, ${last.statusType})`;

        await message.reply(fullReport);
        chatHistory[user].push({ role: "assistant", content: fullReport });

        delete lastReportRequest[user];
        saveMemory();
        return;
      }
    }

    if (!aiOutput) {
      console.error("⚠️ Empty response:", response);
      await message.reply("Desculpe, tive um probleminha para responder agora. 🐾");
      return;
    }

    chatHistory[user].push({ role: "assistant", content: aiOutput });
    saveMemory();
    await chat.clearState();
    await message.reply(aiOutput);
    console.log(`[${BUSINESS_NAME}] ${aiOutput}`);
  } catch (err) {
    console.error("Error:", err);
    await message.reply("Ops! Tive um probleminha ao processar sua mensagem. 🐾");
  }
});

client.initialize();
