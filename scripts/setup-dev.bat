@echo off
echo Setting up SideEye development environment...

echo.
echo Installing Node.js dependencies...
call npm install

echo.
echo Setting up Python virtual environment...
cd backend
python -m venv venv
call venv\Scripts\activate.bat

echo.
echo Installing Python dependencies...
pip install -r requirements.txt

echo.
echo Running Django migrations...
python manage.py migrate

echo.
echo Creating Django superuser (optional)...
echo You can skip this by pressing Ctrl+C
python manage.py createsuperuser

echo.
echo Setup complete!
echo.
echo To start development:
echo   npm run dev
echo.
echo This will start both the Django backend and Electron frontend.

cd ..
pause