import { useEffect, useState } from "react";

let recognition = null;

try {
  const speechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new speechRecognition();
  console.log(recognition);
  recognition.continuous = true;
  recognition.lang = "en-US";
} catch (err) {
  console.log(err);
}

const useSpeechRecognition = () => {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!recognition) return;
    recognition.onresult = (event) => {
      setText(event.results[event.results.length - 1][0].transcript);
      console.log(event.results[event.results.length - 1][0].transcript);

      // recognition.stop();
      // setListening(false);
    };
  }, []);

  const startListning = () => {
    console.log("start recognition");
    setText("");
    setListening(true);
    recognition.start();
  };

  const stopListening = () => {
    console.log("stopping recognition");
    
    recognition.stop();
    setListening(false);
  };

  return {
    text,
    listening,
    startListning,
    stopListening,
    hasRecognitionSupport: !!recognition,
  };
};
export default useSpeechRecognition;
