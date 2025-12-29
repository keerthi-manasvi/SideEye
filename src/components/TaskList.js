import React, { useState, useEffect } from 'react';
import './TaskList.css';

const TaskList = () => {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [currentEnergy, setCurrentEnergy] = useState(0.5);

  useEffect(() => {
    // Load initial tasks (placeholder data)
    setTasks([
      {
        id: 1,
        title: 'Review code documentation',
        complexity: 0.3,
        energyMatch: 0.3,
        completed: false,
        category: 'routine'
      },
      {
        id: 2,
        title: 'Design new feature architecture',
        complexity: 0.9,
        energyMatch: 0.9,
        completed: false,
        category: 'creative'
      },
      {
        id: 3,
        title: 'Update project dependencies',
        complexity: 0.2,
        energyMatch: 0.2,
        completed: false,
        category: 'maintenance'
      },
      {
        id: 4,
        title: 'Write unit tests for API',
        complexity: 0.6,
        energyMatch: 0.6,
        completed: false,
        category: 'development'
      }
    ]);
  }, []);

  const sortedTasks = [...tasks]
    .filter(task => !task.completed)
    .sort((a, b) => {
      // Sort by energy match (closer to current energy level is better)
      const aMatch = 1 - Math.abs(a.energyMatch - currentEnergy);
      const bMatch = 1 - Math.abs(b.energyMatch - currentEnergy);
      return bMatch - aMatch;
    });

  const completedTasks = tasks.filter(task => task.completed);

  const handleAddTask = () => {
    if (newTask.trim()) {
      const task = {
        id: Date.now(),
        title: newTask,
        complexity: 0.5, // Default complexity
        energyMatch: 0.5, // Will be calculated by AI in future
        completed: false,
        category: 'general'
      };
      setTasks(prev => [...prev, task]);
      setNewTask('');
    }
  };

  const handleToggleTask = (taskId) => {
    setTasks(prev => prev.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed }
        : task
    ));
  };

  const getEnergyRecommendation = () => {
    if (currentEnergy > 0.7) {
      return "High energy detected! Perfect time for complex or creative tasks.";
    } else if (currentEnergy > 0.4) {
      return "Moderate energy level. Good for development and problem-solving tasks.";
    } else {
      return "Low energy detected. Consider routine tasks or take a break.";
    }
  };

  const getCategoryColor = (category) => {
    const colors = {
      routine: '#4CAF50',
      creative: '#9C27B0',
      maintenance: '#FF9800',
      development: '#2196F3',
      general: '#607D8B'
    };
    return colors[category] || colors.general;
  };

  return (
    <div className="task-list">
      <div className="task-header">
        <h2>Energy-Based Task Management</h2>
        <p>Tasks automatically sorted based on your current energy level</p>
      </div>

      <div className="energy-status">
        <div className="energy-indicator">
          <label>Current Energy Level:</label>
          <div className="energy-bar">
            <div 
              className="energy-fill"
              style={{ width: `${currentEnergy * 100}%` }}
            ></div>
          </div>
          <span className="energy-value">{(currentEnergy * 100).toFixed(0)}%</span>
        </div>
        <div className="energy-recommendation">
          {getEnergyRecommendation()}
        </div>
      </div>

      <div className="task-input">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Add a new task..."
          onKeyPress={(e) => e.key === 'Enter' && handleAddTask()}
        />
        <button onClick={handleAddTask}>Add Task</button>
      </div>

      <div className="tasks-container">
        <div className="task-section">
          <h3>Recommended Tasks</h3>
          <p className="section-description">
            Sorted by energy match - tasks at the top are best suited for your current energy level
          </p>
          {sortedTasks.length === 0 ? (
            <div className="no-tasks">
              No pending tasks. Add some tasks to get started!
            </div>
          ) : (
            <div className="task-items">
              {sortedTasks.map((task, index) => (
                <div key={task.id} className="task-item">
                  <div className="task-priority">#{index + 1}</div>
                  <div className="task-content">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span 
                        className="task-category"
                        style={{ backgroundColor: getCategoryColor(task.category) }}
                      >
                        {task.category}
                      </span>
                      <span className="task-complexity">
                        Complexity: {(task.complexity * 100).toFixed(0)}%
                      </span>
                      <span className="task-match">
                        Energy Match: {(1 - Math.abs(task.energyMatch - currentEnergy)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <button 
                    className="task-complete"
                    onClick={() => handleToggleTask(task.id)}
                  >
                    Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {completedTasks.length > 0 && (
          <div className="task-section">
            <h3>Completed Tasks</h3>
            <div className="task-items completed">
              {completedTasks.map(task => (
                <div key={task.id} className="task-item completed">
                  <div className="task-content">
                    <div className="task-title">{task.title}</div>
                    <div className="task-meta">
                      <span 
                        className="task-category"
                        style={{ backgroundColor: getCategoryColor(task.category) }}
                      >
                        {task.category}
                      </span>
                    </div>
                  </div>
                  <button 
                    className="task-undo"
                    onClick={() => handleToggleTask(task.id)}
                  >
                    Undo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskList;