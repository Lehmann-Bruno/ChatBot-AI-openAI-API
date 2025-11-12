// tools.js
export const petshopTools = [
  {
    name: "add_pet",
    type: "function",
    description: "Cadastrar um novo pet no sistema.",
    parameters: {
      type: "object",
      properties: {
        petName: { type: "string", description: "Nome do pet" },
        species: { type: "string", description: "Espécie (cão, gato, etc.)" },
        breed: { type: "string", description: "Raça do pet (opcional)" },
      },
      required: ["petName", "species"],
    },
  },
  {
    name: "list_pets",
    type: "function",
    description: "Listar todos os pets cadastrados do cliente.",
  },
  {
    name: "send_pet_report",
    type: "function",
    description: "Enviar ou agendar o relatório de status do pet (banho, tosa, hospedagem, transporte).",
    parameters: {
      type: "object",
      properties: {
        petName: { type: "string", description: "Nome do pet" },
        service: {
          type: "string",
          description: "Serviço (banho, tosa, hospedagem, etc.)",
        },
        statusType: {
          type: "string",
          description:
            "Tipo de relatório (início, finalização, saída para entrega, etc.)",
        },
        sendTime: {
          type: "string",
          description: "Horário de envio do relatório",
        },
      },
      required: ["petName", "service", "statusType", "sendTime"],
    },
  },
  {
    name: "delete_pet",
    type: "function",
    description: "Solicitar a exclusão de um pet do cadastro (gera pedido pendente).",
    parameters: {
        type: "object",
        properties: {
        petName: { type: "string", description: "Nome do pet a ser removido" },
        reason: {
            type: "string",
            description: "Motivo opcional da remoção (ex: pet doado, faleceu, etc.)"
        }
        },
        required: ["petName"]
    }
 },
 {
    name: "schedule_consultation",
    type: "function",
    description: "Solicitar o agendamento de uma consulta veterinária, a ser validada por um atendente humano.",
    parameters: {
      type: "object",
      properties: {
        petName: { type: "string", description: "Nome do pet para a consulta" },
        consultationType: {
          type: "string",
          description:
            "Tipo de consulta (ex.: vacinação, check-up, comportamento, emergência, retorno, etc.)",
        },
        preferredTime: {
          type: "string",
          description:
            "Horário ou período desejado (opcional, ex.: amanhã à tarde)",
        },
      },
      required: ["petName", "consultationType"],
    },
  }

];

export const allTools = [...petshopTools];
