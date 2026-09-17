for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy).textContent;
    const status = document.getElementById('copy-status');
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = '복사 완료';
      status.textContent = '설치 명령어를 복사했습니다. 터미널에 붙여 넣으세요.';
      setTimeout(() => { button.textContent = '명령어 복사'; }, 2500);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      status.textContent = '자동 복사가 지원되지 않습니다. 선택된 명령어를 직접 복사하세요.';
    }
  });
}
