/*const express = require("express");
const { WebSocketServer } = require("ws");
const http = require("http");
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
*/
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });




let ValMode = 1;

app.get("/", (req, res) => {
  res.send("Serveur WebSocket actif");
});

class DataTable {
  constructor(maxSize = 5000) {
    this.maxSize = maxSize;
    this.table = [];
  }

  addData(data) {
    const options = {
      timeZone: 'Europe/Paris',
      hour12: false, // Si vous voulez afficher l'heure au format 24h
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };

    const date = new Date();
    const heureReelle = new Intl.DateTimeFormat('fr-FR', options).format(date);
    //console.log(`Heure réelle en France : ${heureReelle}`);

    const entry = { data: data, time: heureReelle };
    this.table.unshift(entry); // Ajoute la nouvelle donnée
    if (this.table.length > 8500) {
      this.table.pop(); // Supprime le dernier élément si le tableau a plus de x éléments
    }
  }

  getData() {
    return this.table;
  }

  getLastNEntries(n) {
    return this.table.slice(-n); // Obtenir les n dernières entrées
  }
}

const dataTable = new DataTable(8500);  //5000
let lastDataTableSendTime = Date.now(); // Temps du dernier envoi de la DataTable
let lastAddDataTime = Date.now(); // Temps du dernier envoi de la DataTable
const DATA_TABLE_INTERVAL = 1000; // 10 secondes

wss.on("connection", (ws) => {
  console.log("Nouvelle connexion établie");

  ws.on("message", (message) => {
    if (message.length < 2000) {
      //console.log("Message texte reçu: taille:", message.length, "bytes");
      let data;
      try {
        data = JSON.parse(message);
      } catch (error) {
        console.log("Erreur de parsing JSON:", error);
        return; // Ne pas aller plus loin si JSON invalide
      }
      // Vérifier si temperature existe
      if (data.temperature !== undefined) {
        //console.log("data.temperature:", data.temperature);
        //console.log("mode:", ValMode);
        const currentTime2 = Date.now();
        if (currentTime2 - lastAddDataTime >= 10000) { //10000 delai acquistion
          // Mettre à jour le dernier temps d'envoi
          lastAddDataTime = currentTime2;
          dataTable.addData(data.temperature);
        }
      } else {
        console.log("Pas de temperature dans les données reçues.");
      }

      const currentTime = Date.now();
      // Vérifier si 10 secondes se sont écoulées depuis le dernier envoi de la DataTable
      if (currentTime - lastDataTableSendTime >= DATA_TABLE_INTERVAL) {
        // Mettre à jour le dernier temps d'envoi
        lastDataTableSendTime = currentTime;

        let tableauOriginal = dataTable.getData(); // Obtenir les données réelles du dataTable

        const nombreDeLignes = 12; // Choisissez le nombre de lignes à moyenne
        const TabMoyHeure = [];

        // Vérifier qu'il y a assez de lignes dans tableauOriginal
        if (tableauOriginal.length >= nombreDeLignes) {
          for (let i = 0; i < tableauOriginal.length; i += nombreDeLignes) {
            // Sélectionner le bloc de `nombreDeLignes`
            const bloc = tableauOriginal.slice(i, i + nombreDeLignes);

            // Calculer la moyenne des `data`
            const somme = bloc.reduce((acc, curr) => acc + parseFloat(curr.data), 0);
            const moyenne = (somme / bloc.length).toFixed(2); // Fixer à 2 décimales

            // Prendre le dernier `time` du bloc
            const dernierTime = bloc[bloc.length - 1].time;

            // Ajouter au tableau de moyenne
            TabMoyHeure.push({ data: moyenne, time: dernierTime });
          }

          //console.log('TabMoyHeure', TabMoyHeure.slice(0, 2)); // Ceci doit maintenant fonctionner correctement
        } else {
          console.log('Pas assez de données pour calculer une moyenne heure.');
        }

        const TabMoyJour = [];
        // Vérifier qu'il y a assez de lignes dans TabMoyHeure
        if (TabMoyHeure.length >= nombreDeLignes) {
          for (let i = 0; i < TabMoyHeure.length; i += nombreDeLignes) {
            // Sélectionner le bloc de `nombreDeLignes`
            const bloc = TabMoyHeure.slice(i, i + nombreDeLignes);

            // Calculer la moyenne des `data`
            const somme = bloc.reduce((acc, curr) => acc + parseFloat(curr.data), 0);
            const moyenne = (somme / bloc.length).toFixed(2); // Fixer à 2 décimales

            // Prendre le dernier `time` du bloc
            const dernierTime = bloc[bloc.length - 1].time;

            // Ajouter au tableau de moyenne
            TabMoyJour.push({ data: moyenne, time: dernierTime });
          }

          //console.log('TabMoyJour', TabMoyJour.slice(0, 2)); // Ceci doit maintenant fonctionner correctement
        } else {
          console.log('Pas assez de données pour calculer une moyenne jour.');
        }

        if (ValMode === 2) {
          const dataTable2 = TabMoyHeure.slice(0, 30);
          data.dataTable2 = dataTable2;
        } else if (ValMode === 3) {
          const dataTable2 = TabMoyJour.slice(0, 30);
          data.dataTable2 = dataTable2;
        } else {
          //const dataTable2 = dataTable.getLastNEntries(30);
          const dataTable2 = tableauOriginal.slice(0, 30);
          data.dataTable2 = dataTable2;
        }

        // Diffuser le message avec la dataTable2 à tous les clients connectés
        let modifiedMessage = JSON.stringify(data);
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(modifiedMessage);
            //console.log("message modif avec dataTable2 envoyé:", modifiedMessage);
          }
        });
      } else {
        // Sinon, envoyer uniquement le message original
        let originalMessage = JSON.stringify(data);
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(originalMessage);
            //console.log("message original envoyé:", originalMessage);
          }
        });
      }

      // Traitement du message reçu
      if (message.length > 100) {
        //console.log("data.temperature:", data.temperature);
        //dataTable.addData(data.temperature);
      } else {
        if (data.command && typeof data.command === 'string') {
          //console.log("commande:", data.command);
          //const VarDebut = data.command.match(/^VarDebut=(\d+)$/);
          const VarMode = data.command.match(/^VarMode=(\d+)$/);

          if (VarMode) {
            // Si le format correspond, on extrait la valeur numérique
            ValMode = parseInt(VarMode[1], 10);
            //console.log("mode:", ValMode);
          }

        }
      }

    } else {
      //console.log("Image reçue, taille:", message.length, "bytes");

      // Diffuser l'image à tous les clients connectés
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(message);
        }
      });
    }
  });

  ws.on("close", () => console.log("Client déconnecté"));
}); //fin connection", (ws)

const listener = server.listen(process.env.PORT, () => {
  console.log("Votre app écoute sur le port " + listener.address().port);
});