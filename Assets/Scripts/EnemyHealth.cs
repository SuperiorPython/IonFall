using UnityEngine;

/// <summary>
/// MINIMAL STUB — exists only so Projectile.cs has something to compile against
/// before the full enemy system is built in Phase 2.
/// This will be expanded significantly (spawning, movement, death effects, etc.)
/// when we get to EnemyAI.cs and the spawner.
/// </summary>
public class EnemyHealth : MonoBehaviour
{
    [SerializeField] private float health = 30f;

    // Static — one event all enemies share, so ScoreManager can subscribe once
    // rather than needing a reference to every individual enemy instance.
    public static event System.Action OnAnyEnemyDeath;

    public void TakeDamage(float amount)
    {
        health -= amount;
        if (health <= 0f)
        {
            OnAnyEnemyDeath?.Invoke();
            Destroy(gameObject);
        }
    }
}
