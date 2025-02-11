const cameraView = document.getElementById('camera-view');
const cameraStream = document.getElementById('camera-stream');
const takePhotoButton = document.getElementById('take-photo');
const uploadPhotoButton = document.getElementById('upload-photo');
const uploadPhotoDemoButton = document.getElementById('upload-photo-demo');
const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const confirmPhotoButton = document.getElementById('confirm-photo');
const retakePhotoButton = document.getElementById('retake-photo');
const verifyApiKeyButton = document.getElementById('verify-api-key');
const resultText = document.getElementById('result');
const copyResultButton = document.getElementById('copy-result');
const startAppButton = document.getElementById('start-app');
const resetAppButton = document.getElementById('reset-app');

function showLoadingSpinner() {
  const spinner = document.getElementById('loading-spinner');
  spinner.classList.remove('hidden');
}

function hideLoadingSpinner() {
  const spinner = document.getElementById('loading-spinner');
  spinner.classList.add('hidden');
}

function startApp() {
  showScreen('screen-initial');
}

function stopCamera() {
  const stream = cameraStream.srcObject;
  if (stream) {
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
  }
  cameraStream.srcObject = null;
}

function startCamera() {
  const constraints = {
    video: {
      facingMode: { ideal: 'environment' }, // stnd camera & resolution //
      width: { min: 1280 },
      height: { min: 720 },
      frameRate: { min: 30 }
    }
  };

  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(stream => {
      cameraStream.srcObject = stream;
      cameraStream.classList.remove('hidden');
      document.getElementById('camera-placeholder').classList.add('hidden');
    })
    .catch(error => {
      console.error('Erro ao acessar a câmera: ', error);
      alert('Por favor, permita o acesso à câmera para usar o aplicativo.');
    });
}

function triggerCameraFlash() {
  const camera = document.getElementById('camera-stream');
  camera.style.animation = 'camera-flash 0.15s ease';
  setTimeout(() => {
    camera.style.animation = '';
  }, 150);
}

function capturePhoto() {
  triggerCameraFlash();
  setTimeout(() => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = cameraStream.videoWidth;
    canvas.height = cameraStream.videoHeight;
    context.drawImage(cameraStream, 0, 0, canvas.width, canvas.height);
    photoPreview.innerHTML = '';
    photoPreview.appendChild(canvas);

    showScreen('screen-confirm');
  }, 200);
}

function showScreen(screenId) {
  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    screen.classList.add('hidden');
  });

  const screenToShow = document.getElementById(screenId);
  if (screenToShow) {
    screenToShow.classList.remove('hidden');
  }

  if (screenId === 'screen-initial') {
    startCamera();
  }
}

function loadPhoto(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.src = e.target.result;
      img.onload = function () {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.objectFit = 'contain'; // desktop
        photoPreview.innerHTML = '';
        photoPreview.appendChild(canvas);
        showScreen('screen-confirm');
      };
    };
    reader.readAsDataURL(file);
  }
}

function isValidApiKey(apiKey) {
  return (
    apiKey.startsWith('sk') && /[a-z]/.test(apiKey) && /[A-Z]/.test(apiKey) && apiKey.length >= 20
  );
}

async function confirmPhoto() {
  const apiKey = document.getElementById('api-key-input').value.trim();

  // api key validation
  if (!apiKey) {
    alert('Por favor, insira uma chave API válida.');
    return;
  }

  if (!isValidApiKey(apiKey)) {
    alert('A chave API inserida é inválida.');
    return;
  }

  try {
    showLoadingSpinner();

    const canvas = photoPreview.querySelector('canvas');
    const imageData = canvas.toDataURL();

    // OCR
    const {
      data: { text }
    } = await Tesseract.recognize(
      imageData,
      'por', // lang
      { logger: info => console.log(info) }
    );

    console.log('Texto extraído via OCR: ', text); // ocr text

    const prompt = `Extraia todos os dados do menu e forneça a resposta somente no formato JSON, estruturado corretamente com indentação e quebras de linha.
     O JSON deve conter as categorias de Saladas(se houver) e Acompanhamentos. 
     Para cada item, inclua o nome do prato, os ingredientes(se houver), divisão entre entradas, principais e sobremesas(se houver) e preço. Atenção na diferença de preços por porções: Individual, Meia e Inteira(utilizar esses parâmetros se necessário, para separar preços). 
     Atenção ao título do cardápio caso haja. 
     Certifique-se de seguir o formato de indentação e quebras de linha. Aqui está o menu: ${text}`;

    const AIresponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}` // API key goes here
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              'Você é um especialista em estruturação de dados gastronômicos. Siga rigorosamente as instruções do usuário e retorne os dados apenas em formato JSON'
          },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000
      })
    });

    if (!AIresponse.ok) {
      throw new Error(`Erro na comunicação com API: ${AIresponse.status} ${AIresponse.statusText}`);
    }

    const responseData = await AIresponse.json();
    const rawContent = responseData.choices[0].message.content;

    try {
      const parsedData = JSON.parse(rawContent);
      resultText.textContent = JSON.stringify(parsedData, null, 2);
      showScreen('screen-final');
      showFeedback('Dados extraídos com sucesso!', 'text-green-600');
    } catch (parseError) {
      throw new Error(`Formato inválido recebido: ${parseError.message}`);
    }
  } catch (error) {
    showFeedback(`${error.message}`, 'bg-red-300 text-red-800');
    console.error(error);
  } finally {
    hideLoadingSpinner();
  }
}

// feedbacks
function showFeedback(message, styles = 'bg-gray-100 text-gray-700') {
  const feedbackElement = document.getElementById('feedback');
  const messageElement = document.getElementById('feedback-message');

  feedbackElement.classList.remove('hidden', 'bg-red-100', 'bg-green-100', 'bg-gray-100');
  messageElement.className = `text-sm italic px-3 py-2 rounded-lg ${styles}`;
  messageElement.textContent = message;

  feedbackElement.classList.remove('hidden');
  setTimeout(() => feedbackElement.classList.add('hidden'), 5000);
}

function copyResult() {
  navigator.clipboard
    .writeText(resultText.textContent)
    .then(() => {
      alert('Copiado com sucesso!');
    })
    .catch(() => {
      alert('Erro ao copiar: ', err);
    });
}

function resetApp() {
  resultText.textContent = 'Resultado JSON';
  showScreen('screen-initial');
  startCamera();
}

// event listeners
takePhotoButton.addEventListener('click', capturePhoto);
uploadPhotoButton.addEventListener('click', () => photoInput.click());
startAppButton.addEventListener('click', () => {
  showScreen('screen-initial');
  startCamera();
}); // demo screen button //

uploadPhotoDemoButton.addEventListener('click', () => {
  photoInput.click();
});

photoInput.addEventListener('change', event => {
  const file = event.target.files[0];
  if (file && file.type.startsWith('image/')) {
    loadPhoto(event);
    showScreen('screen-confirm');
    photoInput.value = '';
  } else {
    alert('Por favor, carregue um arquivo de imagem válido.');
    photoInput.value = '';
  }
});

verifyApiKeyButton.addEventListener('click', async () => {
  const apiKey = document.getElementById('api-key-input').value.trim();

  if (!apiKey) {
    showFeedback('Por favor, insira uma chave API válida.', 'bg-red-300 text-red-800');
    return;
  }

  if (!isValidApiKey(apiKey)) {
    showFeedback('A chave API inserida é inválida.', 'bg-red-300 text-red-800');
    return;
  }

  showLoadingSpinner();

  setTimeout(() => {
    hideLoadingSpinner();
    showFeedback('Chave API verificada com sucesso!', 'bg-green-300 text-green-800');
  }, 1000); // spinner-delay
});

confirmPhotoButton.addEventListener('click', confirmPhoto);
retakePhotoButton.addEventListener('click', () => {
  stopCamera();
  showScreen('screen-demo');
});
copyResultButton.addEventListener('click', copyResult);
resetAppButton.addEventListener('click', () => {
  stopCamera();
  resetApp();
});

// stops camera if app window is not on-screen and starts camera if current screen is home-screen //
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    stopCamera();
  } else if (document.visibilityState === 'visible') {
    setTimeout(() => {
      const currentScreen = document.querySelector('.screen:not(.hidden)').id;
      if (currentScreen === 'screen-initial') {
        startCamera();
      }
    }, 100);
  }
});

showScreen('screen-demo');
