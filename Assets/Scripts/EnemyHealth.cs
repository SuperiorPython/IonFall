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

    public void TakeDamage(float amount)
    {
        health -= amount;
        if (health <= 0f)
        {
            Destroy(gameObject);
        }
    }
}
