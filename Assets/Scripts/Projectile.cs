using UnityEngine;

/// <summary>
/// A simple projectile that travels in a straight line and deals damage on contact.
/// Attach to the projectile prefab, which should have a Rigidbody2D (kinematic or dynamic)
/// and a Collider2D set to "Is Trigger".
/// </summary>
public class Projectile : MonoBehaviour
{
    [Header("Movement")]
    [SerializeField] private float speed = 15f;
    [SerializeField] private float lifetime = 3f; // safety cleanup if it never hits anything

    [Header("Combat")]
    [SerializeField] private float baseDamage = 10f;

    [Header("References")]
    [SerializeField] private PlayAreaBounds playAreaBounds; // optional — leave empty to disable the despawn check

    private Vector2 direction;
    private float bonusDamageMultiplier = 1f;
    private int remainingPierces = 0;

    private void Start()
    {
        Destroy(gameObject, lifetime);
    }

    /// <summary>
    /// Called by TurretShoot right after Instantiate. damageMultiplier and pierceCount
    /// come from purchased upgrades (Reinforced Barrel, Piercing Rounds, Railgun Core, etc.) —
    /// TurretShoot tracks the current totals, this projectile just receives them.
    /// </summary>
    public void Init(Vector2 dir, float damageMultiplier, int pierceCount)
    {
        direction = dir.normalized;
        bonusDamageMultiplier = damageMultiplier;
        remainingPierces = pierceCount;
    }

    /// <summary>Back-compat overload for direction-only firing (no upgrades applied).</summary>
    public void SetDirection(Vector2 dir)
    {
        direction = dir.normalized;
    }

    private void Update()
    {
        transform.Translate(direction * speed * Time.deltaTime, Space.World);

        if (playAreaBounds != null && playAreaBounds.IsOutside(transform.position))
        {
            Destroy(gameObject);
        }
    }

    private void OnTriggerEnter2D(Collider2D other)
    {
        var enemyHealth = other.GetComponent<EnemyHealth>();
        if (enemyHealth == null) return; // not an enemy (dome, other projectiles, etc.) — ignore

        enemyHealth.TakeDamage(baseDamage * bonusDamageMultiplier);

        if (remainingPierces > 0)
        {
            remainingPierces--; // keep traveling, hit something else
        }
        else
        {
            Destroy(gameObject);
        }
    }
}
