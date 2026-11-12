import { useEffect } from 'react';

export function RulesDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={onClose}>
      <div className="card rules" onClick={(e) => e.stopPropagation()}>
        <h2 id="rules-title">Как играть</h2>
        <p>
          <b>Цель</b> — первой выложить на стол все свои плитки.
        </p>
        <p>
          Плитки — числа от 1 до 13 четырёх цветов: <span className="ink c0">♥ сердечки</span>, <span className="ink c1">💧 капельки</span>,{' '}
          <span className="ink c2">★ звёздочки</span>, <span className="ink c3">☾ луны</span>. Каждой по две (при 5 игроках — по три), плюс
          котики-джокеры. В начале у всех по 14 плиток.
        </p>
        <ul>
          <li>
            <b>Ряд</b> — 3 и больше чисел подряд одного цвета: 4 · 5 · 6 ♥
          </li>
          <li>
            <b>Группа</b> — 3–4 одинаковых числа разных цветов: 8♥ 8💧 8★
          </li>
          <li>Комбинация — это плитки, стоящие вплотную в одной строке. Пустая клетка их разделяет.</li>
          <li>
            <b>Первый выход</b> — комбинации из своих плиток на сумму от 30 очков. До него трогать стол нельзя.
          </li>
          <li>После первого выхода можно как угодно перекладывать всё на столе — главное, чтобы в конце хода все комбинации были правильными.</li>
          <li>Нечего выложить — возьми плитку из мешочка 👜.</li>
          <li>Котик-джокер заменяет любую плитку. Его можно забрать из комбинации, но он должен остаться на столе.</li>
          <li>Если время вышло, а на столе всё собрано правильно — ход засчитывается сам. Если нет, плитки возвращаются в руку и берётся одна из мешочка.</li>
          <li>Если мешочек пуст и все пасуют — побеждает тот, у кого в руке меньше очков.</li>
        </ul>
        <p className="muted">Проигравшие теряют сумму плиток в руке (котик = 30), победитель забирает её себе.</p>
        <button className="primary" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
