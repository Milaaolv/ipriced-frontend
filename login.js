const form = document.getElementById('login-form');
const emailInput = document.getElementById('inp-email');
const passwordInput = document.getElementById('inp-password');

form.addEventListener('submit', async function (e) {
    e.preventDefault(); // impede envio real

    // Resetar mensagens de erro
    document.querySelectorAll('.error-msg').forEach(msg => msg.remove());

    let valid = true;

    // Validar email
    if (!emailInput.value.includes('@')) {
        showError(emailInput, 'Digite um email válido.');
        valid = false;
    }

    // Validar senha (mínimo 6 caracteres)
    if (passwordInput.value.length < 6) {
        showError(passwordInput, 'Senha deve ter pelo menos 6 caracteres.');
        valid = false;
    }

    // Só envia pro backend se passou na validação
    if (valid) {
        try {
            const response = await fetch("http://localhost:3000/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    email: emailInput.value,
                    password: passwordInput.value
                })
            });

            const result = await response.text();
            alert(result);

            if (result.includes("sucesso")) {
                window.location.href = "ipriced.html"; // redireciona
            }
        } catch (err) {
            console.error("Erro ao conectar com o servidor:", err);
            alert("Erro ao conectar com o servidor!");
        }
    }
});

function showError(input, message) {
    const error = document.createElement('div');
    error.className = 'error-msg';
    error.style.color = 'red';
    error.style.fontSize = '0.9em';
    error.textContent = message;
    input.insertAdjacentElement('afterend', error);
}

