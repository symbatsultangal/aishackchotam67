export function buildTelegramApiUrl(botToken: string, method: string): string {
  return `https://api.telegram.org/bot${botToken}/${method}`;
}

export async function sendTelegramText(params: {
  botToken: string;
  chatId: string | number;
  text: string;
}): Promise<unknown> {
  const response = await fetch(buildTelegramApiUrl(params.botToken, "sendMessage"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram sendMessage failed with status ${response.status}`);
  }

  return response.json();
}
