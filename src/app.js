const cameraView = document.getElementById('camera-view');
const cameraStream = document.getElementById('camera-stream');
const takePhotoButton = document.getElementById('take-photo');
const uploadPhotoButton = document.getElementById('upload-photo');
const photoInput = document.getElementById('photo-input');
const photoPreview = document.getElementById('photo-preview');
const confirmPhotoButton = document.getElementById('confirm-photo');
const retakePhotoButton = document.getElementById('retake-photo');
const resultText = document.getElementById('result');
const copyResultButton = document.getElementById('copy-result');
const resetAppButton = document.getElementById('reset-app');

function startCamera() {
  navigator.mediaDevices.getUserMedia({ video: true })
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

function capturePhoto() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = cameraStream.videoWidth;
  canvas.height = cameraStream.videoHeight;
  context.drawImage(cameraStream, 0, 0, canvas.width, canvas.height);
  photoPreview.innerHTML = '';
  photoPreview.appendChild(canvas);
  showScreen('screen-confirm');
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
}

function loadPhoto(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.src = e.target.result;
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0);
        photoPreview.innerHTML = '';
        photoPreview.appendChild(canvas);
        showScreen('screen-confirm');
      };
    };
    reader.readAsDataURL(file);
  }
}

async function confirmPhoto() {
  try {
    const canvas = photoPreview.querySelector('canvas');
    const imageData = canvas.toDataURL();

    const { data: { text } } = await Tesseract.recognize(  // OCR
      imageData, 
      'por', // lang
      { logger: (info) => console.log(info) }
    );

    console.log('Texto extraído da imagem: ', text);


    const prompt = `Extraia os dados do menu e forneça a resposta somente no formato JSON, estruturado corretamente com indentação e quebras de linha.
     O JSON deve conter as categorias de Saladas e Acompanhamentos. 
     Para cada item, inclua o nome do prato, os ingredientes e o preço. 
     Certifique-se de seguir o formato de indentação e quebras de linha. Aqui está o menu: ${text}`;
    
    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer --api-key--", // OpenAI API goes here
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "Você extrai dados de Food menus e os apresenta em formato JSON." },
          { role: "user", content: prompt },
        ],
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`Erro na API: ${openaiResponse.statusText}`);
    }

    const openaiData = await openaiResponse.json();
    const responseContent = openaiData.choices[0].message.content;

  
    resultText.textContent = JSON.stringify(JSON.parse(responseContent), null, 2);
    showScreen('screen-final');
  } catch (error) {
    alert("Erro ao processar a imagem ou no envio para a API: " + error.message);
  }
}

function copyResult() {
  navigator.clipboard.writeText(resultText.textContent)
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
photoInput.addEventListener('change', loadPhoto);
confirmPhotoButton.addEventListener('click', confirmPhoto);
retakePhotoButton.addEventListener('click', () => {
  showScreen('screen-initial');
  startCamera();
});
copyResultButton.addEventListener('click', copyResult);
resetAppButton.addEventListener('click', resetApp);


startCamera();
showScreen('screen-initial');