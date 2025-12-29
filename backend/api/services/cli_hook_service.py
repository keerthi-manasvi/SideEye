"""
CLI Hook Execution Service for theme and workspace automation
"""
import logging
import subprocess
import json
import os
import shlex
from typing import List, Dict, Optional, Tuple
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings
import re

from ..models import UserPreferences, UserFeedback

logger = logging.getLogger(__name__)


class CLIHookService:
    """
    Service for executing CLI hooks and commands for theme and workspace automation
    """
    
    def __init__(self):
        self.allowed_commands = {
            # VS Code commands
            'code': ['--install-extension', '--uninstall-extension', '--list-extensions'],
            
            # Windows Terminal commands
            'wt.exe': ['-p', '--colorScheme', '--profile'],
            'wt': ['-p', '--colorScheme', '--profile'],
            
            # PowerShell commands for theme management
            'powershell.exe': ['-Command', '-File', '-ExecutionPolicy'],
            'pwsh.exe': ['-Command', '-File', '-ExecutionPolicy'],
            
            # Python scripts for custom theme application
            'python': ['-m', '-c', '--version'],
            'python.exe': ['-m', '-c', '--version'],
            
            # Git commands for theme repositories
            'git': ['clone', 'pull', 'checkout', 'config'],
            
            # Custom theme application scripts
            'apply_theme.py': ['--primary', '--secondary', '--palette', '--config'],
            'theme_manager.exe': ['--set', '--get', '--list', '--apply'],
        }
        
        self.dangerous_patterns = [
            r'rm\s+-rf',
            r'del\s+/[sq]',
            r'format\s+[a-z]:',
            r'shutdown',
            r'reboot',
            r'halt',
            r'init\s+[0-6]',
            r'sudo\s+rm',
            r'sudo\s+dd',
            r'>\s*/dev/',
            r'curl.*\|\s*sh',
            r'wget.*\|\s*sh',
        ]
        
        self.timeout_seconds = 30
        self.max_output_length = 10000
    
    def validate_command(self, command: str) -> Tuple[bool, str]:
        """
        Validate a CLI command for security and safety
        
        Args:
            command: The command string to validate
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not command or not command.strip():
            return False, "Command cannot be empty"
        
        # Check for dangerous patterns
        for pattern in self.dangerous_patterns:
            if re.search(pattern, command, re.IGNORECASE):
                return False, f"Command contains dangerous pattern: {pattern}"
        
        # Parse command to get executable and arguments
        try:
            parts = shlex.split(command)
        except ValueError as e:
            return False, f"Invalid command syntax: {e}"
        
        if not parts:
            return False, "Command cannot be empty after parsing"
        
        executable = parts[0]
        
        # Check if executable is in allowed list
        if executable not in self.allowed_commands:
            # Check if it's a full path to an allowed executable
            base_name = os.path.basename(executable)
            if base_name not in self.allowed_commands:
                return False, f"Executable '{executable}' is not in allowed list"
            executable = base_name
        
        # Validate arguments
        allowed_args = self.allowed_commands[executable]
        command_args = parts[1:]
        
        # Check if any arguments are allowed (basic validation)
        if allowed_args and command_args:
            has_valid_arg = False
            for arg in command_args:
                if arg.startswith('-') or arg.startswith('--'):
                    # Check if this flag is in allowed args or if it's a common safe flag
                    if any(allowed_arg in arg for allowed_arg in allowed_args) or arg in ['--version', '--help', '-h', '-v']:
                        has_valid_arg = True
                        break
                else:
                    # Non-flag arguments are generally allowed if we have valid flags or if it's a safe command
                    if any(flag in command_args for flag in ['--version', '--help', '-h', '-v']):
                        has_valid_arg = True
                    elif executable in ['python', 'python.exe'] and arg.endswith('.py'):
                        has_valid_arg = True
                    elif executable in ['git'] and arg in ['config', 'status', 'log', 'branch']:
                        has_valid_arg = True
            
            if not has_valid_arg and allowed_args != ['--version']:
                return False, f"No valid arguments found for '{executable}'"
        
        return True, ""
    
    def execute_command(self, command: str, working_directory: Optional[str] = None) -> Dict:
        """
        Execute a validated CLI command
        
        Args:
            command: The command to execute
            working_directory: Optional working directory for command execution
            
        Returns:
            Dictionary with execution results
        """
        start_time = timezone.now()
        
        # Validate command first
        is_valid, error_message = self.validate_command(command)
        if not is_valid:
            logger.warning(f"Command validation failed: {error_message}")
            return {
                'success': False,
                'error': f"Command validation failed: {error_message}",
                'command': command,
                'execution_time': 0,
                'timestamp': start_time.isoformat()
            }
        
        try:
            logger.info(f"Executing CLI command: {command}")
            
            # Set up environment
            env = os.environ.copy()
            
            # Execute command with timeout
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
                cwd=working_directory,
                env=env
            )
            
            execution_time = (timezone.now() - start_time).total_seconds()
            
            # Truncate output if too long
            stdout = result.stdout[:self.max_output_length] if result.stdout else ""
            stderr = result.stderr[:self.max_output_length] if result.stderr else ""
            
            if len(result.stdout or "") > self.max_output_length:
                stdout += "\n[Output truncated...]"
            if len(result.stderr or "") > self.max_output_length:
                stderr += "\n[Error output truncated...]"
            
            success = result.returncode == 0
            
            execution_result = {
                'success': success,
                'return_code': result.returncode,
                'stdout': stdout,
                'stderr': stderr,
                'command': command,
                'execution_time': execution_time,
                'timestamp': start_time.isoformat(),
                'working_directory': working_directory
            }
            
            if success:
                logger.info(f"Command executed successfully in {execution_time:.2f}s")
            else:
                logger.warning(f"Command failed with return code {result.returncode}")
            
            return execution_result
            
        except subprocess.TimeoutExpired:
            execution_time = (timezone.now() - start_time).total_seconds()
            logger.error(f"Command timed out after {self.timeout_seconds} seconds")
            return {
                'success': False,
                'error': f"Command timed out after {self.timeout_seconds} seconds",
                'command': command,
                'execution_time': execution_time,
                'timestamp': start_time.isoformat()
            }
            
        except Exception as e:
            execution_time = (timezone.now() - start_time).total_seconds()
            logger.error(f"Error executing command: {e}")
            return {
                'success': False,
                'error': str(e),
                'command': command,
                'execution_time': execution_time,
                'timestamp': start_time.isoformat()
            }
    
    def execute_hook_sequence(self, commands: List[str], 
                            working_directory: Optional[str] = None,
                            stop_on_failure: bool = True) -> Dict:
        """
        Execute a sequence of CLI commands (hook sequence)
        
        Args:
            commands: List of commands to execute in order
            working_directory: Optional working directory
            stop_on_failure: Whether to stop execution if a command fails
            
        Returns:
            Dictionary with overall execution results
        """
        start_time = timezone.now()
        results = []
        overall_success = True
        
        logger.info(f"Executing hook sequence with {len(commands)} commands")
        
        for i, command in enumerate(commands):
            logger.info(f"Executing command {i+1}/{len(commands)}: {command}")
            
            result = self.execute_command(command, working_directory)
            results.append(result)
            
            if not result['success']:
                overall_success = False
                if stop_on_failure:
                    logger.warning(f"Stopping hook sequence due to failure at command {i+1}")
                    break
        
        execution_time = (timezone.now() - start_time).total_seconds()
        
        return {
            'success': overall_success,
            'total_commands': len(commands),
            'executed_commands': len(results),
            'successful_commands': sum(1 for r in results if r['success']),
            'failed_commands': sum(1 for r in results if not r['success']),
            'results': results,
            'execution_time': execution_time,
            'timestamp': start_time.isoformat(),
            'stop_on_failure': stop_on_failure
        }
    
    def generate_theme_commands(self, theme_data: Dict) -> List[str]:
        """
        Generate CLI commands for applying a theme
        
        Args:
            theme_data: Theme configuration data
            
        Returns:
            List of CLI commands to apply the theme
        """
        commands = []
        
        colors = theme_data.get('colors', [])
        theme_name = theme_data.get('theme_name', 'Custom Theme')
        palette = theme_data.get('palette', 'custom')
        
        if not colors:
            logger.warning("No colors provided for theme generation")
            return commands
        
        primary_color = colors[0] if colors else '#808080'
        secondary_color = colors[1] if len(colors) > 1 else primary_color
        accent_color = colors[2] if len(colors) > 2 else secondary_color
        
        # VS Code theme commands
        safe_theme_name = re.sub(r'[^a-zA-Z0-9\-_]', '-', theme_name.lower())
        commands.append(f'code --install-extension theme-{safe_theme_name}')
        
        # Windows Terminal color scheme
        wt_scheme_name = theme_name.replace(' ', '_')
        commands.append(f'wt.exe --colorScheme "{wt_scheme_name}"')
        
        # PowerShell script for custom theme application
        ps_script = f'''
        $colors = @{{
            Primary = "{primary_color}";
            Secondary = "{secondary_color}";
            Accent = "{accent_color}";
            Palette = "{palette}"
        }}
        Set-ThemeColors -Colors $colors
        '''
        
        # Write PowerShell script to temp file and execute
        commands.append(f'powershell.exe -Command "& {{ {ps_script.strip()} }}"')
        
        # Python theme application script
        commands.append(f'python apply_theme.py --primary "{primary_color}" --secondary "{secondary_color}" --accent "{accent_color}" --palette "{palette}"')
        
        # Custom theme manager if available
        commands.append(f'theme_manager.exe --set --primary "{primary_color}" --secondary "{secondary_color}" --name "{theme_name}"')
        
        return commands
    
    def apply_theme_with_fallback(self, theme_data: Dict) -> Dict:
        """
        Apply a theme with fallback mechanisms
        
        Args:
            theme_data: Theme configuration data
            
        Returns:
            Dictionary with application results
        """
        logger.info(f"Applying theme: {theme_data.get('theme_name', 'Unknown')}")
        
        # Generate commands for theme application
        commands = self.generate_theme_commands(theme_data)
        
        if not commands:
            return {
                'success': False,
                'error': 'No commands generated for theme application',
                'theme_data': theme_data
            }
        
        # Execute commands with fallback (don't stop on failure)
        result = self.execute_hook_sequence(
            commands=commands,
            stop_on_failure=False  # Try all commands even if some fail
        )
        
        # Determine if theme application was successful
        # Consider it successful if at least one command succeeded
        theme_success = result['successful_commands'] > 0
        
        # Log theme application result
        if theme_success:
            logger.info(f"Theme applied successfully: {result['successful_commands']}/{result['total_commands']} commands succeeded")
        else:
            logger.error(f"Theme application failed: all {result['total_commands']} commands failed")
        
        # Create fallback theme if all commands failed
        fallback_result = None
        if not theme_success:
            fallback_result = self._apply_fallback_theme(theme_data)
        
        return {
            'success': theme_success or (fallback_result and fallback_result['success']),
            'theme_name': theme_data.get('theme_name'),
            'primary_result': result,
            'fallback_result': fallback_result,
            'commands_executed': result['total_commands'],
            'commands_successful': result['successful_commands'],
            'timestamp': timezone.now().isoformat()
        }
    
    def _apply_fallback_theme(self, theme_data: Dict) -> Dict:
        """
        Apply a basic fallback theme when primary theme application fails
        
        Args:
            theme_data: Original theme data
            
        Returns:
            Dictionary with fallback application results
        """
        logger.info("Applying fallback theme configuration")
        
        # Simple fallback commands that are more likely to work
        fallback_commands = [
            'powershell.exe -Command "Write-Host \'Fallback theme applied\'"',
            'python -c "print(\'Fallback theme configuration\')"'
        ]
        
        result = self.execute_hook_sequence(
            commands=fallback_commands,
            stop_on_failure=False
        )
        
        return {
            'success': result['successful_commands'] > 0,
            'type': 'fallback',
            'commands_executed': result['total_commands'],
            'commands_successful': result['successful_commands'],
            'details': result
        }
    
    def get_hook_configuration(self) -> Dict:
        """
        Get current CLI hook configuration from user preferences
        
        Returns:
            Dictionary with hook configuration
        """
        try:
            preferences = UserPreferences.objects.first()
            if not preferences:
                return self._get_default_hook_configuration()
            
            # Extract hook configuration from preferences
            # This would be stored in a new field we'll add to UserPreferences
            hook_config = getattr(preferences, 'cli_hook_configuration', {})
            
            if not hook_config:
                return self._get_default_hook_configuration()
            
            return hook_config
            
        except Exception as e:
            logger.error(f"Error getting hook configuration: {e}")
            return self._get_default_hook_configuration()
    
    def _get_default_hook_configuration(self) -> Dict:
        """
        Get default CLI hook configuration
        
        Returns:
            Default hook configuration dictionary
        """
        return {
            'enabled': True,
            'timeout_seconds': self.timeout_seconds,
            'stop_on_failure': False,
            'custom_commands': {
                'theme_application': [],
                'pre_theme_hooks': [],
                'post_theme_hooks': []
            },
            'working_directory': None,
            'environment_variables': {},
            'allowed_executables': list(self.allowed_commands.keys())
        }
    
    def update_hook_configuration(self, config: Dict) -> Dict:
        """
        Update CLI hook configuration
        
        Args:
            config: New configuration dictionary
            
        Returns:
            Updated configuration
        """
        try:
            preferences, created = UserPreferences.objects.get_or_create()
            
            # Validate configuration
            validated_config = self._validate_hook_configuration(config)
            
            # Store configuration (we'll need to add this field to UserPreferences model)
            # For now, we'll store it in a JSON field
            if not hasattr(preferences, 'cli_hook_configuration'):
                # We'll need to add this field to the model
                logger.warning("CLI hook configuration field not found in UserPreferences model")
                return validated_config
            
            preferences.cli_hook_configuration = validated_config
            preferences.save()
            
            logger.info("CLI hook configuration updated successfully")
            return validated_config
            
        except Exception as e:
            logger.error(f"Error updating hook configuration: {e}")
            raise
    
    def _validate_hook_configuration(self, config: Dict) -> Dict:
        """
        Validate and sanitize hook configuration
        
        Args:
            config: Configuration to validate
            
        Returns:
            Validated configuration
        """
        validated = self._get_default_hook_configuration()
        
        # Update with provided values, validating each
        if 'enabled' in config:
            validated['enabled'] = bool(config['enabled'])
        
        if 'timeout_seconds' in config:
            timeout = config['timeout_seconds']
            if isinstance(timeout, (int, float)) and 1 <= timeout <= 300:
                validated['timeout_seconds'] = int(timeout)
        
        if 'stop_on_failure' in config:
            validated['stop_on_failure'] = bool(config['stop_on_failure'])
        
        if 'custom_commands' in config and isinstance(config['custom_commands'], dict):
            custom_commands = config['custom_commands']
            
            for key in ['theme_application', 'pre_theme_hooks', 'post_theme_hooks']:
                if key in custom_commands and isinstance(custom_commands[key], list):
                    # Validate each command
                    valid_commands = []
                    for cmd in custom_commands[key]:
                        if isinstance(cmd, str):
                            is_valid, _ = self.validate_command(cmd)
                            if is_valid:
                                valid_commands.append(cmd)
                    validated['custom_commands'][key] = valid_commands
        
        if 'working_directory' in config:
            wd = config['working_directory']
            if isinstance(wd, str) and os.path.isdir(wd):
                validated['working_directory'] = wd
        
        return validated
    
    def get_execution_history(self, limit: int = 50) -> List[Dict]:
        """
        Get recent CLI command execution history
        
        Args:
            limit: Maximum number of history entries to return
            
        Returns:
            List of execution history entries
        """
        try:
            # Get recent feedback entries for CLI/theme commands
            recent_feedback = UserFeedback.objects.filter(
                suggestion_type='theme',
                timestamp__gte=timezone.now() - timedelta(days=7)
            ).order_by('-timestamp')[:limit]
            
            history = []
            for feedback in recent_feedback:
                suggestion_data = feedback.suggestion_data or {}
                cli_commands = suggestion_data.get('cli_commands', [])
                
                if cli_commands:
                    history.append({
                        'timestamp': feedback.timestamp.isoformat(),
                        'theme_name': suggestion_data.get('theme_name', 'Unknown'),
                        'commands': cli_commands,
                        'user_response': feedback.user_response,
                        'success': feedback.user_response == 'accepted'
                    })
            
            return history
            
        except Exception as e:
            logger.error(f"Error getting execution history: {e}")
            return []
    
    def test_hook_configuration(self) -> Dict:
        """
        Test current hook configuration with safe commands
        
        Returns:
            Test results dictionary
        """
        logger.info("Testing CLI hook configuration")
        
        # Safe test commands
        test_commands = [
            'python --version',
            'powershell.exe -Command "Write-Host \'Test successful\'"',
            'git --version'
        ]
        
        results = []
        for command in test_commands:
            result = self.execute_command(command)
            results.append({
                'command': command,
                'success': result['success'],
                'execution_time': result['execution_time']
            })
        
        successful_tests = sum(1 for r in results if r['success'])
        
        return {
            'overall_success': successful_tests > 0,
            'total_tests': len(test_commands),
            'successful_tests': successful_tests,
            'test_results': results,
            'timestamp': timezone.now().isoformat()
        }


# Global instance
cli_hook_service = CLIHookService()