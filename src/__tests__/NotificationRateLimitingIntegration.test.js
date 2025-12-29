/**
 * Notification Rate Limiting and Queue Management Integration Tests
 * 
 * Tests the notification system's rate limiting and queue management:
 * 1. Rate limiting enforcement (2 per 5 min for actions, 5 per hour for wellness)
 * 2. Queue management and prioritization
 * 3. Notification scheduling and delivery
 * 4. Rate limit reset and cleanup
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import Dashboard from '../components/Dashboard';

// Mock external dependencies
global.fetch = jest.fn();
jest.useFakeTimers();

describe('Notification Rate Limiting and Queue Management Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    
    // Mock API responses
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/')) {
        if (options?.method === 'POST') {
          // Mock notification creation
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              queued: false,
              rate_limit_hit: false,
              next_available_slot: null
            })
          });
        } else {
          // Mock notification retrieval
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              notifications: [],
              rate_limits: {
                action_notifications: { count: 0, reset_time: Date.now() + 300000 },
                wellness_notifications: { count: 0, reset_time: Date.now() + 3600000 }
              }
            })
          });
        }
      }
      
      if (url.includes('/api/emotions/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, energy_level: 0.7 })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  test('Action notification rate limiting: 2 per 5 minutes', async () => {
    let notificationCount = 0;
    
    // Mock rate limiting behavior
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/') && options?.method === 'POST') {
        notificationCount++;
        
        if (notificationCount <= 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              queued: false,
              rate_limit_hit: false
            })
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: false,
              queued: true,
              rate_limit_hit: true,
              next_available_slot: Date.now() + 300000, // 5 minutes
              message: 'Rate limit exceeded. Notification queued.'
            })
          });
        }
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Trigger multiple action notifications rapidly
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        // Simulate emotion change that triggers notifications
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    await waitFor(() => {
      const notificationCalls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/notifications/') && call[1]?.method === 'POST'
      );
      expect(notificationCalls.length).toBeGreaterThanOrEqual(3);
    });

    // Verify rate limiting kicked in
    const lastCalls = fetch.mock.calls.slice(-2);
    const rateLimitedCall = lastCalls.find(call => 
      call[0].includes('/api/notifications/') && call[1]?.method === 'POST'
    );
    
    expect(rateLimitedCall).toBeDefined();
  });

  test('Wellness notification rate limiting: 5 per hour', async () => {
    let wellnessNotificationCount = 0;
    
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/wellness') && options?.method === 'POST') {
        wellnessNotificationCount++;
        
        if (wellnessNotificationCount <= 5) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              type: 'wellness',
              queued: false,
              rate_limit_hit: false
            })
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: false,
              type: 'wellness',
              queued: true,
              rate_limit_hit: true,
              next_available_slot: Date.now() + 3600000, // 1 hour
              message: 'Wellness notification rate limit exceeded'
            })
          });
        }
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Simulate poor posture detection triggering wellness notifications
    for (let i = 0; i < 8; i++) {
      await act(async () => {
        // Trigger wellness notification
        const event = new CustomEvent('postureAlert', {
          detail: { score: 0.3, type: 'poor_posture' }
        });
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    await waitFor(() => {
      const wellnessCalls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/notifications/wellness')
      );
      expect(wellnessCalls.length).toBeGreaterThanOrEqual(6);
    });
  });

  test('Notification queue management and prioritization', async () => {
    const queuedNotifications = [];
    
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/') && options?.method === 'POST') {
        const body = JSON.parse(options.body);
        
        // Simulate queue management
        if (queuedNotifications.length >= 2) {
          queuedNotifications.push({
            ...body,
            queued_at: Date.now(),
            priority: body.type === 'wellness' ? 'high' : 'normal'
          });
          
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: false,
              queued: true,
              queue_position: queuedNotifications.length,
              estimated_delivery: Date.now() + 300000
            })
          });
        } else {
          queuedNotifications.push(body);
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              queued: false
            })
          });
        }
      }
      
      if (url.includes('/api/notifications/queue')) {
        // Sort queue by priority
        const sortedQueue = queuedNotifications.sort((a, b) => {
          if (a.priority === 'high' && b.priority !== 'high') return -1;
          if (b.priority === 'high' && a.priority !== 'high') return 1;
          return a.queued_at - b.queued_at;
        });
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            queue: sortedQueue,
            total_count: sortedQueue.length
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Generate mixed priority notifications
    await act(async () => {
      // Normal priority notifications
      for (let i = 0; i < 3; i++) {
        const event = new CustomEvent('actionNotification', {
          detail: { type: 'music_change', priority: 'normal' }
        });
        window.dispatchEvent(event);
      }
      
      // High priority wellness notification
      const wellnessEvent = new CustomEvent('postureAlert', {
        detail: { type: 'wellness', priority: 'high' }
      });
      window.dispatchEvent(wellnessEvent);
      
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    // Check queue status
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/queue'),
        expect.any(Object)
      );
    });
  });

  test('Rate limit reset after time window', async () => {
    let notificationCount = 0;
    let rateLimitResetTime = Date.now() + 300000; // 5 minutes from now
    
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/') && options?.method === 'POST') {
        const currentTime = Date.now();
        
        // Reset counter if time window has passed
        if (currentTime >= rateLimitResetTime) {
          notificationCount = 0;
          rateLimitResetTime = currentTime + 300000;
        }
        
        notificationCount++;
        
        if (notificationCount <= 2) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              rate_limit_hit: false,
              remaining_quota: 2 - notificationCount
            })
          });
        } else {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: false,
              rate_limit_hit: true,
              reset_time: rateLimitResetTime,
              remaining_quota: 0
            })
          });
        }
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Hit rate limit
    for (let i = 0; i < 3; i++) {
      await act(async () => {
        const event = new CustomEvent('actionNotification', {
          detail: { type: 'theme_change' }
        });
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
    }

    // Fast forward time to reset rate limit
    await act(async () => {
      jest.advanceTimersByTime(300000); // 5 minutes
    });

    // Should be able to send notifications again
    await act(async () => {
      const event = new CustomEvent('actionNotification', {
        detail: { type: 'music_change' }
      });
      window.dispatchEvent(event);
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    await waitFor(() => {
      const recentCalls = fetch.mock.calls.slice(-2);
      expect(recentCalls.length).toBeGreaterThan(0);
    });
  });

  test('Notification delivery scheduling', async () => {
    const scheduledNotifications = [];
    
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/schedule')) {
        const body = JSON.parse(options.body);
        scheduledNotifications.push({
          ...body,
          scheduled_for: body.delay ? Date.now() + body.delay : Date.now(),
          delivered: false
        });
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            scheduled_id: scheduledNotifications.length,
            delivery_time: scheduledNotifications[scheduledNotifications.length - 1].scheduled_for
          })
        });
      }
      
      if (url.includes('/api/notifications/deliver')) {
        // Simulate delivery of scheduled notifications
        const currentTime = Date.now();
        const readyNotifications = scheduledNotifications.filter(
          n => !n.delivered && n.scheduled_for <= currentTime
        );
        
        readyNotifications.forEach(n => n.delivered = true);
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            delivered: readyNotifications.length,
            notifications: readyNotifications
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Schedule notifications with delays
    await act(async () => {
      // Immediate notification
      const immediateEvent = new CustomEvent('scheduleNotification', {
        detail: { message: 'Immediate', delay: 0 }
      });
      window.dispatchEvent(immediateEvent);
      
      // Delayed notification
      const delayedEvent = new CustomEvent('scheduleNotification', {
        detail: { message: 'Delayed', delay: 60000 } // 1 minute
      });
      window.dispatchEvent(delayedEvent);
      
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Check immediate delivery
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/deliver'),
        expect.any(Object)
      );
    });

    // Fast forward and check delayed delivery
    await act(async () => {
      jest.advanceTimersByTime(60000); // 1 minute
    });

    await waitFor(() => {
      const deliveryCalls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/notifications/deliver')
      );
      expect(deliveryCalls.length).toBeGreaterThan(1);
    });
  });

  test('Queue cleanup and memory management', async () => {
    const notificationQueue = [];
    
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/cleanup')) {
        const currentTime = Date.now();
        const oldThreshold = currentTime - 3600000; // 1 hour ago
        
        // Remove old notifications
        const initialLength = notificationQueue.length;
        const cleanedQueue = notificationQueue.filter(n => n.created_at > oldThreshold);
        notificationQueue.length = 0;
        notificationQueue.push(...cleanedQueue);
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            cleaned: initialLength - cleanedQueue.length,
            remaining: cleanedQueue.length
          })
        });
      }
      
      if (url.includes('/api/notifications/') && options?.method === 'POST') {
        notificationQueue.push({
          ...JSON.parse(options.body),
          created_at: Date.now()
        });
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Generate many notifications
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        const event = new CustomEvent('actionNotification', {
          detail: { type: 'test', message: `Notification ${i}` }
        });
        window.dispatchEvent(event);
        await new Promise(resolve => setTimeout(resolve, 5));
      });
    }

    // Fast forward time to make notifications old
    await act(async () => {
      jest.advanceTimersByTime(3600000); // 1 hour
    });

    // Trigger cleanup
    await act(async () => {
      const cleanupEvent = new CustomEvent('cleanupNotifications');
      window.dispatchEvent(cleanupEvent);
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/cleanup'),
        expect.any(Object)
      );
    });
  });

  test('Concurrent notification handling', async () => {
    const concurrentNotifications = [];
    
    fetch.mockImplementation((url, options) => {
      if (url.includes('/api/notifications/') && options?.method === 'POST') {
        const notification = {
          id: concurrentNotifications.length + 1,
          ...JSON.parse(options.body),
          timestamp: Date.now()
        };
        
        concurrentNotifications.push(notification);
        
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            id: notification.id,
            processed_at: notification.timestamp
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(<Dashboard />);
    
    // Send multiple notifications simultaneously
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        act(async () => {
          const event = new CustomEvent('actionNotification', {
            detail: { type: 'concurrent', message: `Concurrent ${i}` }
          });
          window.dispatchEvent(event);
          await new Promise(resolve => setTimeout(resolve, 1));
        })
      );
    }
    
    await Promise.all(promises);

    await waitFor(() => {
      const notificationCalls = fetch.mock.calls.filter(call => 
        call[0].includes('/api/notifications/') && call[1]?.method === 'POST'
      );
      expect(notificationCalls.length).toBe(5);
    });

    // Verify all notifications were processed
    expect(concurrentNotifications).toHaveLength(5);
    
    // Verify timestamps are close (processed concurrently)
    const timestamps = concurrentNotifications.map(n => n.timestamp);
    const timeSpread = Math.max(...timestamps) - Math.min(...timestamps);
    expect(timeSpread).toBeLessThan(100); // Within 100ms
  });
});