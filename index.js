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

  const program_name = "Hidetag Jhonny";

  const author =
    chalk.yellow("\nCódigo fuente: ") +
    chalk.underline.greenBright("https://t.me/djhonnyb\n");

  const howToUseEn =
    chalk.magenta.bold("Cómo usar:\n") +
    chalk.blueBright(
      `Once the QR code is scanned and connected to your WhatsApp account, you can send any text message.
To trigger the hidetag, send a message to a group containing any emoji.\n`
    );

  const howToUseId =
    chalk.magenta.bold("Cómo usar:Una vez que el código QR se escanea y se conecta a tu cuenta de WhatsApp, puedes enviar cualquier mensaje de texto.
Para activar el hidetag, envía un mensaje a un grupo que contenga cualquier emoji.\n") +
    chalk.blueBright(
      `\n`
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

      spinner.start("Por favor escanee el código QR...");
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
          "conexión cerrada debido a ",
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
      spinner.succeed("opened connection").start("Esperando nuevo mensaje...");
    }
  });

  sock.ev.on("creds.update", saveCreds);

let mensajeEnviado = {};
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
                `New hidetag message requested into group: ${chalk.underline.bold.yellowBright(
                  groupName
                )} (${
                  groupParticipants.length
                } participants)\nHidetag message: ${textMessage}\n\n`
              )
              //.start();

            // edit message, then mentions all participants.
            sock.sendMessage(groupJid, {
              text: textMessage,
              //edit: message.key,
              mentions: groupParticipants.map((item) => item.id),
            });
          }
        } catch (error) {
          spinner
            .fail(
              `Falló el envio de mensaje con hidetag. Error: ${error.toString()}`
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
                `Nuevo memsaje de imagen con hidetag: ${textMessage} Solocitado para el grupo: ${chalk.underline.bold.yellowBright(
                  groupName
                )} (${
                  groupParticipants.length
                } participants)\nHidetag message: ${textMessage}\n\n`
              )
              //.start();

            // edit message, then mentions all participants.
            sock.sendMessage(groupJid, {
              image: message.message.imageMessage,
              caption: textMessage,
              //edit: message.key,
              mentions: groupParticipants.map((item) => item.id),
            });
          }
        } catch (error) {
          spinner
            .fail(
              `Falló el envio de memsaje usando hidetag. Error: ${error.toString()}`
            )
            .start();
        }
      }
    }
  });
};

showBanner();

whatsapp();
