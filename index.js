import ora from "ora";
import chalk from "chalk";
import clear from "console-clear";
import figlet from "figlet";
import qrcode from "qrcode-terminal";
import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs-extra";

const logger = pino({
  level: "silent",
});

const spinner = ora("Iniciando...").start();

const showBanner = () => {
  clear();

  const program_name = "Hidetag Whatsapp";

  const author =
    chalk.yellow("\nCodigo fuente: ") +
    chalk.underline.greenBright("https://t.me/djhonnyb\n");

  const howToUseEn =
    chalk.magenta.bold("Cómo usar:\n") +
    chalk.blueBright(
      `Despues de escanear el código QR y conectar tu cuenta de WhatsApp, puedes enviar mensajes de texto libremente.
      Para utilizar el hidetag, simplemente envía un mensaje a un grupo con cualquier emoji.\n`
    );

  const howToUseId =
    chalk.magenta.bold("Instrucciones de uso:\n") +
    chalk.blueBright(
      `Una vez que hayas escaneado el código QR y te hayas conectado a WhatsApp, puedes enviar mensaje de texto libremente.
      Para utilizar el hidetag, simplemente envía un mensaje a un grupo con cualquier emoji.\n`
    );

  const banner = chalk.magentaBright(figlet.textSync(program_name));

  console.log(banner);

  console.log(author);

  console.log(howToUseEn);

  console.log(howToUseId);

  console.log("\n\n");
};

const whatsapp = async () => {
  const { state, saveCreds } = await useMultiFileAuthState(".auth_sessions");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ["djhonnyb", "Chrome", "20.0.04"],
    syncFullHistory: false,
    generateHighQualityLinkPreview: false,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      showBanner();
      spinner.stop();
      chalk.magentaBright(
        qrcode.generate(qr, {
          small: true,
        })
      );

      spinner.start("Porfavor escanee el código QR...");
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

      const loggedOut =
        lastDisconnect.error?.output?.statusCode === DisconnectReason.loggedOut;

      const requiredRestart =
        lastDisconnect.error?.output?.statusCode ===
        DisconnectReason.restartRequired;
      spinner
        .warn(
          "conexión cerrado debido a: ",
          lastDisconnect.error,
          ", reconnecting ",
          shouldReconnect
        )
        .start();

      if (loggedOut) {
        fs.emptyDirSync(".auth_sessions");
        showBanner();
        whatsapp();
        return;
      }

      // reconnect if not logged out
      if (shouldReconnect || requiredRestart) {
        showBanner();
        spinner.start("reconectando...");
        whatsapp();
      }
    } else if (connection === "open") {
      spinner.succeed("conexión abierta").start("Esperando nuevo mensaje...");
    }
  });

  sock.ev.on("creds.update", saveCreds);
let mensajeEnviado = {};
  const menssageQueue = [];
  const sendMessageFromQueue = async () => {
    if (messageQueue.length > 0) {
      const { group, textMessage, mentions } = messageQueue.shift();
      try {
        await sock.sendMessage(groupJid, { text: textMessage, mentions });
        spinner.info(`Mensaje enviado correctamente`);
      } catch (error) {
        spinner.fail(`Error al enviar mensaje: ${error.toString()}`);
      }
      setTimeout(sendMessageFromQueue, 5000);
    }
  };
  sock.ev.on("messages.upsert", async (messages) => {
    if (
      messages.messages[0].key.fromMe &&
      messages.messages[0].key.remoteJid.includes("@g.us")
    ) {
      const message = messages.messages[0];

      const groupJid = message.key.remoteJid;

      const group = await sock.groupMetadata(groupJid);

      const groupParticipants = group.participants;

      const groupName = group.subject;

      //   console.log(
      //     message,
      //     groupParticipants.map((item) => item.id)
      //   );

      if (
        message.message.extendedTextMessage?.text ||
        message.message.conversation
      ) {
        let textMessage =
          message.message.extendedTextMessage?.text ||
          message.message.conversation;

        let emojies;
        try {
          emojies = textMessage.match(
            /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu
          );

          if (!emojies) {
            return;
          }

          if (emojies.length > 0 && !mensajeEnviado[message.key.remoteJid]) {
            mensajeEnviado[message.key.remoteJid] = true;
            spinner
              .info(
                `Nuevo mensaje de hidetag para el grupo: ${chalk.underline.bold.yellowBright(
                  groupName
                )} (${
                  groupParticipants.length
                } participants)\nHidetag message: ${textMessage}\n\n`
              );
              //.start();

            // edit message, then mentions all participants.
            messageQueue.push({groupJid, 
              text: textMessage,
              //edit: message.key,
              mentions: groupParticipants.map((item) => item.id),
            });
            if (messageQueue.length === 1){
              sendMessageFromQueue();
            }
          }
        } catch (error) {
          spinner
            .fail(
              `Error de envío de mensaje con hidetag. Error: ${error.toString()}`
            )
            .start();
        }
      }

      if (message.message.imageMessage?.caption) {
        let textMessage = message.message.imageMessage?.caption;

        let emojies;
        try {
          emojies = textMessage.match(
            /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu
          );

          if (!emojies) {
            return;
          }

          if (emojies.length > 0 && !mensajeEnviado[message.key.remoteJid]) {
            mensajeEnviado[message.key.remoteJid] = true;
            spinner
              .info(
                `New hidetag image message: ${textMessage} requested into group: ${chalk.underline.bold.yellowBright(
                  groupName
                )} (${
                  groupParticipants.length
                } participants)\nHidetag message: ${textMessage}\n\n`
              );
              //.start();

            // edit message, then mentions all participants.
            messageQueue.push({groupJid, 
              image: message.message.imageMessage,
              caption: textMessage,
              //edit: message.key,
              mentions: groupParticipants.map((item) => item.id),
            });
              if (messageQueue.length === 1){
              sendMessageFromQueue();
            }
          }
        } catch (error) {
          spinner
            .fail(
              `Error de envío de mensaje con hidetag. Error: ${error.toString()}`
            )
            .start();
        }
      }
    }
  });
};

showBanner();

whatsapp();
