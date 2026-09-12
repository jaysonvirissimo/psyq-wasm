	.file	1 "t06_ptr.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	ld_i
	.align	2
	.globl	ld_s
	.align	2
	.globl	ld_us
	.align	2
	.globl	ld_c
	.align	2
	.globl	ld_sc
	.align	2
	.globl	ld_uc
	.align	2
	.globl	st_i
	.align	2
	.globl	st_s
	.align	2
	.globl	st_c
	.align	2
	.globl	ld_off
	.align	2
	.globl	swap
	.align	2
	.globl	arr_idx
	.align	2
	.globl	arr2
	.data
	.align	2
table:
	.word	1
	.word	2
	.word	3
	.word	4
	.word	5
	.word	6
	.word	7
	.word	8
	.text
	.align	2
	.globl	tbl

	.text
	.text
	.ent	ld_i
ld_i:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,0($4)
	j	$31
	.end	ld_i
	.text
	.ent	ld_s
ld_s:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lh	$2,0($4)
	j	$31
	.end	ld_s
	.text
	.ent	ld_us
ld_us:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lhu	$2,0($4)
	j	$31
	.end	ld_us
	.text
	.ent	ld_c
ld_c:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lbu	$2,0($4)
	j	$31
	.end	ld_c
	.text
	.ent	ld_sc
ld_sc:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lb	$2,0($4)
	j	$31
	.end	ld_sc
	.text
	.ent	ld_uc
ld_uc:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lbu	$2,0($4)
	j	$31
	.end	ld_uc
	.text
	.ent	st_i
st_i:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sw	$5,0($4)
	.set	macro
	.set	reorder

	.end	st_i
	.text
	.ent	st_s
st_s:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sh	$5,0($4)
	.set	macro
	.set	reorder

	.end	st_s
	.text
	.ent	st_c
st_c:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.set	noreorder
	.set	nomacro
	j	$31
	sb	$5,0($4)
	.set	macro
	.set	reorder

	.end	st_c
	.text
	.ent	ld_off
ld_off:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$3,12($4)
	lw	$2,-8($4)
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$3,$2
	.set	macro
	.set	reorder

	.end	ld_off
	.text
	.ent	swap
swap:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lw	$2,0($5)
	lw	$3,0($4)
	sw	$2,0($4)
	.set	noreorder
	.set	nomacro
	j	$31
	sw	$3,0($5)
	.set	macro
	.set	reorder

	.end	swap
	.text
	.ent	arr_idx
arr_idx:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$5,$5,2
	addu	$5,$5,$4
	lw	$2,0($5)
	j	$31
	.end	arr_idx
	.text
	.ent	arr2
arr2:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	sll	$6,$6,2
	sll	$5,$5,4
	addu	$5,$5,$4
	addu	$6,$6,$5
	lw	$2,0($6)
	j	$31
	.end	arr2
	.text
	.ent	tbl
tbl:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	lui	$2,%hi(table) # high
	addiu	$2,$2,%lo(table) # low
	andi	$4,$4,0x0007
	sll	$4,$4,2
	addu	$4,$4,$2
	lw	$2,0($4)
	j	$31
	.end	tbl
