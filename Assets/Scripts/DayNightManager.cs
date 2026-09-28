using System;
using UnityEngine;

/// <summary>
/// Drives the core day/night loop. Owns phase state and timing; tells
/// EnemySpawner when to start/stop rather than the spawner deciding for itself.
/// Other systems (mining, shop UI, etc.) should subscribe to the events below
/// rather than polling this script's phase every frame.
/// </summary>
public class DayNightManager : MonoBehaviour
{
    public enum Phase { Day, Night }

    [Header("Timing (seconds)")]
    [SerializeField] private float dayDuration = 20f;
    [SerializeField] private float nightDuration = 30f;
    [SerializeField] private bool startInDay = true; // brief prep before the first night

    [Header("References")]
    [SerializeField] private EnemySpawner enemySpawner;

    public Phase CurrentPhase { get; private set; }
    public int CurrentDay { get; private set; } = 1;
    public float PhaseTimeRemaining { get; private set; }

    // Subscribe to these instead of checking CurrentPhase every frame.
    public event Action<int> OnNightStarted;  // passes night/day number
    public event Action<int> OnDayStarted;

    private void Start()
    {
        CurrentPhase = startInDay ? Phase.Day : Phase.Night;
        PhaseTimeRemaining = startInDay ? dayDuration : nightDuration;

        // Fire the appropriate start event for whichever phase we're beginning in,
        // so spawning etc. gets wired up correctly from the very first frame.
        if (CurrentPhase == Phase.Night)
        {
            BeginNight();
        }
        else
        {
            BeginDay();
        }
    }

    private void Update()
    {
        PhaseTimeRemaining -= Time.deltaTime;
        if (PhaseTimeRemaining <= 0f)
        {
            AdvancePhase();
        }
    }

    private void AdvancePhase()
    {
        if (CurrentPhase == Phase.Day)
        {
            BeginNight();
        }
        else
        {
            CurrentDay++;
            BeginDay();
        }
    }

    private void BeginNight()
    {
        CurrentPhase = Phase.Night;
        PhaseTimeRemaining = nightDuration;

        enemySpawner?.StartSpawning(CurrentDay);
        OnNightStarted?.Invoke(CurrentDay);
    }

    private void BeginDay()
    {
        CurrentPhase = Phase.Day;
        PhaseTimeRemaining = dayDuration;

        enemySpawner?.StopSpawning();
        OnDayStarted?.Invoke(CurrentDay);
    }
}
