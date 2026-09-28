using System;
using UnityEngine;

/// <summary>
/// Tracks the dome's integrity (health). Fires an event when the dome dies.
/// Attach this to the Dome GameObject.
/// </summary>
public class DomeHealth : MonoBehaviour
{
    [Header("Integrity Settings")]
    [SerializeField] private float maxIntegrity = 100f;
    [SerializeField] private float currentIntegrity;

    // Other systems (UI, game-over logic, etc.) can subscribe to these
    // instead of polling this script every frame.
    public event Action<float, float> OnIntegrityChanged; // (current, max)
    public event Action OnDomeDestroyed;

    public float CurrentIntegrity => currentIntegrity;
    public float MaxIntegrity => maxIntegrity;
    public bool IsDestroyed => currentIntegrity <= 0f;

    private void Awake()
    {
        currentIntegrity = maxIntegrity;
    }

    public void TakeDamage(float amount)
    {
        if (IsDestroyed || amount <= 0f) return;

        currentIntegrity = Mathf.Max(0f, currentIntegrity - amount);
        OnIntegrityChanged?.Invoke(currentIntegrity, maxIntegrity);

        if (currentIntegrity <= 0f)
        {
            Die();
        }
    }

    public void Repair(float amount)
    {
        if (IsDestroyed || amount <= 0f) return;

        currentIntegrity = Mathf.Min(maxIntegrity, currentIntegrity + amount);
        OnIntegrityChanged?.Invoke(currentIntegrity, maxIntegrity);
    }

    /// <summary>Called by UpgradeSystem when the player buys a max integrity upgrade.
    /// Also heals by the same amount, so buying this feels immediately useful mid-run.</summary>
    public void IncreaseMaxIntegrity(float amount)
    {
        if (amount <= 0f) return;

        maxIntegrity += amount;
        currentIntegrity += amount;
        OnIntegrityChanged?.Invoke(currentIntegrity, maxIntegrity);
    }

    private void Die()
    {
        OnDomeDestroyed?.Invoke();
        // Deliberately not disabling/destroying anything here yet —
        // game-over handling belongs in a separate GameManager script later.
    }

    // --- Temporary test hook, safe to delete once EnemyAI exists ---
    // Press Space in Play mode to simulate 10 damage, for testing before
    // the enemy system is built.
    private void Update()
    {
        if (Input.GetKeyDown(KeyCode.Space))
        {
            TakeDamage(10f);
            Debug.Log($"Dome integrity: {currentIntegrity}/{maxIntegrity}");
        }
    }
}
