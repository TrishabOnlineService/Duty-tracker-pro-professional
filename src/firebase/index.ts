import firebase from 'firebase/compat/app';
import 'firebase/compat/database';

export const firebaseConfig = { 
  apiKey: "AIzaSyDxqq2PBqrtkTsygyMcIDOvZyx2_-x4QRk", 
  authDomain: "duty-tracker-pro.firebaseapp.com", 
  databaseURL: "https://duty-tracker-pro-default-rtdb.firebaseio.com", 
  projectId: "duty-tracker-pro", 
  storageBucket: "duty-tracker-pro.firebasestorage.app", 
  messagingSenderId: "716525293622", 
  appId: "1:716525293622:web:880f39084c86180fbb0897" 
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const db = firebase.database();
export default firebase;
