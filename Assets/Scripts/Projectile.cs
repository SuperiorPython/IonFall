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
    [SerializeField] private float damage = 10f;
    [SerializeField] private LayerMask hitMask; // set this to your "Enemy" layer in the Inspector

    private Vector2 direction;

    private void Start()
    {
        Destroy(gameObject, lifetime);
    }

    /// <summary>
    /// Called by TurretShoot right after Instantiate to set travel direction.
    /// </summary>
    public void SetDirection(Vector2 dir)
    {
        direction = dir.normalized;
    }

    private void Update()
    {
        transform.Translate(direction * speed * Time.deltaTime, Space.World);
    }

    private void OnTriggerEnter2D(Collider2D other)
    {
        // Only react to objects on the enemy layer, so this doesn't accidentally
        // hit the dome, the turret, or other projectiles.
        if (((1 << other.gameObject.layer) & hitMask) == 0) return;

        // EnemyHealth doesn't exist yet (that's Phase 2) — this call is here
        // so the wiring is correct once it does. For now it'll just no-op if missing.
        var enemyHealth = other.GetComponent<EnemyHealth>();
        if (enemyHealth != null)
        {
            enemyHealth.TakeDamage(damage);
        }

        Destroy(gameObject);
    }
}
