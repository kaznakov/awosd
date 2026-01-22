# Как выполнить push из локального проекта в Git

## 1) Первичная настройка (однократно)

1. Убедитесь, что Git установлен:
   ```bash
   git --version
   ```
2. Настройте имя и email:
   ```bash
   git config --global user.name "Ваше Имя"
   git config --global user.email "you@example.com"
   ```
3. (Опционально) Проверьте настройки:
   ```bash
   git config --global --list
   ```

## 2) Проверка состояния репозитория

1. Перейдите в каталог проекта:
   ```bash
   cd /путь/к/проекту
   ```
2. Убедитесь, что это Git‑репозиторий:
   ```bash
   git status
   ```
   Если видите сообщение `not a git repository`, инициализируйте:
   ```bash
   git init
   ```

## 3) Настройка удалённого репозитория (remote)

1. Посмотрите существующие remotes:
   ```bash
   git remote -v
   ```
2. Если remote ещё не задан, добавьте его:
   ```bash
   git remote add origin https://github.com/USER/REPO.git
   ```
3. Если нужно обновить URL:
   ```bash
   git remote set-url origin https://github.com/USER/REPO.git
   ```
4. Если при push видите `fatal: 'origin' does not appear to be a git repository`:
   - Убедитесь, что remote существует:
     ```bash
     git remote -v
     ```
   - Если `origin` отсутствует, добавьте его заново:
     ```bash
     git remote add origin https://github.com/USER/REPO.git
     ```
   - Если remote назван иначе, используйте его имя в push (например, `git push <имя> <ветка>`).

## 4) Создание коммита

1. Посмотрите, какие файлы изменены:
   ```bash
   git status
   ```
2. Добавьте нужные файлы в индекс:
   ```bash
   git add .
   ```
   или выборочно:
   ```bash
   git add путь/к/файлу
   ```
3. Создайте коммит:
   ```bash
   git commit -m "Краткое описание изменений"
   ```

## 5) Push в удалённый репозиторий

1. Убедитесь, что вы на нужной ветке:
   ```bash
   git branch --show-current
   ```
2. Отправьте изменения:
   ```bash
   git push origin <ветка>
   ```
   Например:
   ```bash
   git push origin main
   ```
3. Если видите ошибку `The current branch master has no upstream branch`:
   ```bash
   git push -u origin master
   ```

## 6) Типовые сценарии и подсказки

- **Первый push новой ветки:**
  ```bash
  git push -u origin <ветка>
  ```
  Флаг `-u` сохранит upstream.

- **Ошибка авторизации:**
  - Для GitHub используйте **Personal Access Token** вместо пароля.
  - Для SSH убедитесь, что ключ добавлен в GitHub/GitLab:
    ```bash
    ssh -T git@github.com
    ```

- **Синхронизация перед push (если есть конфликты):**
  ```bash
  git pull --rebase origin <ветка>
  ```
